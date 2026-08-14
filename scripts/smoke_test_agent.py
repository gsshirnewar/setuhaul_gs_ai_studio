"""Optional live smoke test for the agent conversation loop.

This script makes one real API call. Run it only after you have set OPENAI_API_KEY.

Usage:
    python scripts/smoke_test_agent.py DRV006

The driver_id is a trusted demo identity supplied here, not from LLM input.
"""

import sys
from pathlib import Path

# Allow running from the project root without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.agent import verify_client_configuration, run_agent_turn
from db import repository as repo

DEMO_DRIVER_ID = sys.argv[1] if len(sys.argv) > 1 else "DRV006"


def main():
    print(f"\n=== SetuHaul Agent Smoke Test — driver: {DEMO_DRIVER_ID} ===\n")

    # Step 1: verify configuration without a network call.
    config = verify_client_configuration()
    if not config["configured"]:
        print(f"ERROR: {config['message']}")
        print("Set OPENAI_API_KEY in your environment and re-run.")
        sys.exit(1)
    print(f"Provider OK — model: {config['model']}\n")

    # Step 2: ensure a chat thread exists for persistence.
    thread_result = repo.create_or_get_chat_thread(DEMO_DRIVER_ID, None, "CHECK_STATUS")
    thread_id = thread_result["thread_id"]
    print(f"Thread: {thread_id} ({'new' if thread_result['created'] else 'existing'})\n")

    # Step 3: send a single test turn.
    user_message = "Hi, what is my current dock slot status?"
    print(f"Driver: {user_message}\n")

    result = run_agent_turn(
        driver_id=DEMO_DRIVER_ID,
        thread_id=thread_id,
        user_message=user_message,
        history=[],
    )

    print(f"Agent:  {result['reply']}\n")
    print(f"Tools called: {result['tool_calls_made']}\n")
    print("Smoke test complete.")


if __name__ == "__main__":
    main()
