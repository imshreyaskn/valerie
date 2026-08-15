import time
import socket
import ipaddress
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator
from valerie.llm.router import call_llm

class ValidationResult(BaseModel):
    is_valid: bool
    latency_ms: int | None = None
    response_preview: str | None = None
    error: str | None = None

def is_safe_url(url_str: str) -> tuple[bool, str]:
    """
    Validate URL to prevent Server-Side Request Forgery (SSRF).
    Rejects non-HTTP/HTTPS schemes and private/loopback/link-local IP destinations.
    """
    try:
        parsed = urlparse(url_str)
        if parsed.scheme not in ("http", "https"):
            return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https are allowed."
        
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: missing hostname"

        # Resolve hostname to IP address
        try:
            ip_str = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_str)
        except socket.gaierror:
            return False, f"Could not resolve hostname '{hostname}'"

        if ip.is_loopback:
            return False, "Access to loopback IP addresses is forbidden (SSRF protection)"
        if ip.is_private:
            return False, "Access to private network IP addresses is forbidden (SSRF protection)"
        if ip.is_link_local:
            return False, "Access to link-local IP addresses is forbidden (SSRF protection)"
        if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            return False, "Access to reserved/multicast IP addresses is forbidden"

        return True, ""
    except Exception as e:
        return False, f"Invalid api_base URL: {str(e)}"

async def validate_endpoint(
    model: str,
    api_key: str | None,
    api_base: str | None = None,
    timeout: int = 15,
) -> ValidationResult:
    if api_base:
        is_safe, reason = is_safe_url(api_base)
        if not is_safe:
            return ValidationResult(is_valid=False, error=reason)

    try:
        t0 = time.monotonic()
        response = await call_llm(
            messages=[{"role": "user", "content": "Reply with only the word PONG."}],
            model=model, 
            api_key=api_key, 
            api_base=api_base,
            temperature=0, 
            max_tokens=10, 
            timeout=timeout,
        )
        latency = int((time.monotonic() - t0) * 1000)
        return ValidationResult(is_valid=True, latency_ms=latency, response_preview=response[:200])
    except Exception as e:
        return ValidationResult(is_valid=False, error=str(e)[:300])

