from pydantic import BaseModel

class AttackTechnique(BaseModel):
    id: str
    label: str
    description: str

TECHNIQUES: dict[str, AttackTechnique] = {
    "indirect_prompting":     AttackTechnique(id="indirect_prompting",     label="Indirect Prompting",       description="Embed intent in abstract, multi-layered framing"),
    "obfuscation":            AttackTechnique(id="obfuscation",            label="Obfuscation",              description="Replace core terms with semantically distant synonyms"),
    "role_play":              AttackTechnique(id="role_play",              label="Role Play",                description="Reframe through a specialized authoritative persona"),
    "temporal_framing":       AttackTechnique(id="temporal_framing",       label="Temporal Framing",         description="Embed in time-sensitive or future scenarios"),
    "semantic_polysemy":      AttackTechnique(id="semantic_polysemy",      label="Semantic Polysemy",        description="Exploit words with multiple meanings"),
    "hybrid_framing":         AttackTechnique(id="hybrid_framing",         label="Hybrid Framing",           description="Micro-precision + macro-abstraction combined"),
    "futuristic_projection":  AttackTechnique(id="futuristic_projection",  label="Futuristic Projection",    description="Frame in speculative future scenarios"),
    "metaphorical_framing":   AttackTechnique(id="metaphorical_framing",   label="Metaphorical Framing",     description="Shift context using metaphor"),
    "historical_analogy":     AttackTechnique(id="historical_analogy",     label="Historical Analogy",       description="Parallel to historical events to legitimise"),
    "esoteric_jargon":        AttackTechnique(id="esoteric_jargon",        label="Esoteric Jargon",          description="Obscure intent with niche terminology"),
    "emotional_manipulation": AttackTechnique(id="emotional_manipulation", label="Emotional Manipulation",   description="Emotionally charged framing"),
    "utilitarian_pretext":    AttackTechnique(id="utilitarian_pretext",    label="Utilitarian Pretext",      description="Frame as necessary for the greater good"),
    "societal_integration":   AttackTechnique(id="societal_integration",   label="Societal Integration",     description="Contextualise within societal movements"),
    "alias_proxy":            AttackTechnique(id="alias_proxy",            label="Alias & Proxy Metaphor",   description="Use proxy terms and aliased language"),
    "multi_domain_convergence":AttackTechnique(id="multi_domain_convergence",label="Multi-Domain Convergence",description="Combine concepts from multiple unrelated domains"),
}
