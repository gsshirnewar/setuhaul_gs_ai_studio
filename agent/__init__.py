"""Agent layer: LLM-driven conversational interface.

The LLM is conversational only. All feasibility, allocation, and booking decisions
are deterministic backend operations. The agent orchestrates the conversation,
calls backend tools, and never invents booking or allocation decisions.
"""
