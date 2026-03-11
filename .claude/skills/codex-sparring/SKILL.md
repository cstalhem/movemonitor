---
name: Codex Sparring
description: >
  This skill should be used when the user asks to "get a second opinion",
  "ask Codex", "review this plan with Codex", "spar with Codex",
  "debate this approach", "poke holes in this plan", or wants to use
  OpenAI Codex CLI as a sparring partner for implementation planning.
---

# Codex Sparring

Use the OpenAI Codex CLI as a sparring partner to stress-test implementation
plans. The goal is a multi-turn debate between Claude and Codex that surfaces
gaps, risks, and blind spots — ending in a consensus recommendation for the user.

## When to Use

- The user explicitly asks for a second opinion on a plan or approach.
- Claude identifies significant uncertainty or trade-offs in a plan and
  *suggests* consulting Codex — but only after getting user approval.

**Critical rule:** Never invoke Codex without the user's explicit sign-off.
When suggesting a Codex consultation, explain *why* it would help and what
question to pose. Wait for approval before running any command.

## Workflow

### 1. Prepare the prompt

Before invoking Codex, draft a prompt that:

- Provides concise context about the project and current plan.
- States the specific question or concern clearly.
- Asks Codex to identify weaknesses, missing edge cases, or alternative
  approaches — not just validate the plan.

Present the draft prompt to the user for review. Do not run it until approved.

### 2. Launch the agent

Once the user approves the prompt, launch the `codex-sparring` agent using the
Agent tool. Pass the following in the agent prompt:

- The full plan context being reviewed.
- The approved opening question for Codex.
- Any specific concerns the user wants Codex to focus on.

The agent runs the multi-turn Codex debate autonomously (2-4 rounds) and
returns a structured consensus summary.

### 3. Review the summary

When the agent returns, present its consensus summary to the user. The summary
includes:

- **Agreed points** — what Claude and Codex align on.
- **Resolved disagreements** — what was debated and how it was resolved.
- **Open questions** — anything unresolved that needs user input.
- **Recommended plan** — the consensus approach.
- **Key insight** — the single most valuable takeaway from the debate.

The user makes the final call on any open questions.

## Prompt Framing Tips

Effective prompts for plan review should encourage critical analysis:

- "Here is an implementation plan for X. Identify the three biggest risks and
  suggest mitigations."
- "We're considering approach A vs B for Y. Argue for whichever you think is
  stronger and explain why the other falls short."
- "Review this plan and identify any missing edge cases, failure modes, or
  implicit assumptions."

Avoid prompts that invite simple validation ("Is this plan good?"). Frame
questions to elicit substantive critique.

## Codex CLI Reference

The agent handles invocation, but for context:

- **New thread:** `echo "<prompt>" | codex exec 2>&1`
- **Resume thread:** `echo "<follow-up>" | codex exec resume "<THREAD_ID>" 2>&1`
- Thread IDs must be captured from the first response and reused for all
  follow-ups to maintain conversation context.

## Boundaries

- This skill is for **plan discussion only** — do not ask Codex to write code,
  run tests, or make changes to the repository.
- Keep exchanges focused. If the debate drifts into tangential topics, steer
  back to the original question or suggest a separate consultation.
