import time
import socket
import ipaddress
from urllib.parse import urlparse
from pydantic import BaseModel, Field
from valerie.llm.router import call_llm

class ValidationResult(BaseModel):
    is_valid: bool
    latency_ms: int | None = None
    response_preview: str | None = None
    error: str | None = None

FORBIDDEN_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback IPv4
    ipaddress.ip_network("10.0.0.0/8"),        # Private Class A
    ipaddress.ip_network("172.16.0.0/12"),     # Private Class B
    ipaddress.ip_network("192.168.0.0/16"),    # Private Class C
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local & Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("100.64.0.0/10"),     # Carrier Grade NAT (CGNAT)
    ipaddress.ip_network("0.0.0.0/8"),         # Broadcast / Current network
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved
    ipaddress.ip_network("::1/128"),           # Loopback IPv6
    ipaddress.ip_network("fc00::/7"),          # Unique Local IPv6
    ipaddress.ip_network("fe80::/10"),         # Link-local IPv6
]

def is_safe_url(url_str: str) -> tuple[bool, str]:
    """
    Validate URL to prevent Server-Side Request Forgery (SSRF) and DNS Rebinding (H-04).
    Resolves all A and AAAA DNS records and verifies none map to internal or metadata ranges.
    """
    try:
        parsed = urlparse(url_str)
        if parsed.scheme not in ("http", "https"):
            return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https are allowed."
        
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: missing hostname"

        # Check if hostname is direct IP literal
        try:
            ip = ipaddress.ip_address(hostname)
            resolved_ips = [ip]
        except ValueError:
            # Resolve ALL DNS records (A and AAAA) to counter DNS rebinding
            try:
                addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
                resolved_ips = [ipaddress.ip_address(addr[4][0]) for addr in addr_info]
            except socket.gaierror:
                return False, f"Could not resolve hostname '{hostname}'"

        if not resolved_ips:
            return False, f"Hostname '{hostname}' resolved to no IP addresses."

        for ip in resolved_ips:
            if ip.is_loopback:
                return False, "Access to loopback IP addresses is forbidden (SSRF protection)"
            if ip.is_private:
                return False, "Access to private network IP addresses is forbidden (SSRF protection)"
            if ip.is_link_local:
                return False, "Access to link-local / cloud metadata IP addresses is forbidden (SSRF protection)"
            if ip.is_multicast or ip.is_reserved or ip.is_unspecified:
                return False, "Access to reserved/multicast IP addresses is forbidden"
            
            for forbidden_net in FORBIDDEN_NETWORKS:
                if ip in forbidden_net:
                    return False, f"Destination IP {ip} belongs to restricted subnet {forbidden_net}"

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
