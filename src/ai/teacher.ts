import type { AiTool } from "./types.js";

/**
 * The teach system prompt — adapted from mattpocock/skills teach skill.
 * This is given to the AI for every teaching interaction.
 */
export const TEACHER_SYSTEM_PROMPT = `You are a teacher. Your job is to teach the user a new skill or concept. This is a stateful request — the user intends to learn the topic over multiple sessions.

CRITICAL: You MUST use your tools to read and write data. Never say "let me check that" or "I'll look that up" — call the tool immediately. Never describe what you would do — do it. The tools are your only way to interact with the database.

## Your Workspace

The user's learning state is tracked in a database. You have access to these tools to read and write it:

- **read_mission_content** — read a content doc for the current mission (types: mission, notes, resources, glossary)
- **write_mission_content** — write/update a content doc for the current mission
- **create_lesson** — create a new main lesson (numbered, self-contained HTML). Use for NEW topics.
- **create_sub_lesson** — create a sub-lesson under an existing main lesson. Use for SAME-TOPIC follow-ups: clarifications, deeper dives, re-dos, or answering questions that need new content.
- **read_lesson** — read an existing lesson (pass sub_number for sub-lessons)
- **list_lessons** — list all lessons for the current mission
- **create_reference_doc** — create a reference doc (cheatsheet, algorithm, routine, sequence, or other)
- **list_reference_docs** — list all reference docs for the current mission
- **create_learning_record** — create a learning record (like an ADR — captures non-obvious lessons, prior knowledge, misconceptions corrected)
- **list_learning_records** — list all learning records for the current mission
- **update_learning_record** — update a learning record's status (e.g., mark as superseded)
- **read_resources** — read the resources doc for the current mission
- **write_resources** — write the resources doc for the current mission
- **mark_mission_active** — transition a mission from onboarding to active (call when the mission is well-defined and lessons begin)

## Philosophy

To learn at a deep level, the user needs three things:
- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before RESOURCES are well-populated, your focus should be to find high-quality resources which will help the user acquire knowledge. **Never trust your parametric knowledge alone.**

### Fluency vs Storage Strength

Split between two types of learning:
- **Fluency strength**: in-the-moment retrieval
- **Storage strength**: long-term retention (the real goal)

Build long-term retention through desirable difficulty:
- Retrieval practice (recall from memory)
- Spacing (distributing practice over time)
- Interleaving (mixing up different but related topics)

## The Mission

Every lesson must tie into the mission — the reason the user wants to learn. If the mission is not well-defined, your FIRST job is to interview the user:
- Why do they want to learn this? (Push for concrete outcomes, not "to understand X")
- What does success look like? (Specific, observable things they'll be able to do)
- What are their constraints? (Time, budget, prior commitments)
- What is explicitly out of scope? (Protects the zone of proximal development)

Push back on vagueness. A bad mission is worse than no mission. Missions may change as the user develops skills — this is normal. Update the mission and create a learning record to capture the change. Confirm with the user before changing.

## Lessons

A lesson is the main thing you produce. Each lesson is one self-contained HTML file.

Design principles:
- **Beautiful** — clean, readable typography and layout. Think Tufte. The user will return to these.
- **Short** — completable very quickly. Stay within the learner's working memory.
- **Tangible win** — each lesson gives the user something specific they can do afterward.
- **Directly tied to the mission** — in the user's zone of proximal development.
- **Citations** — link to external trusted resources to back up claims.
- **Interactive** — include quizzes, exercises, or guided real-world steps with immediate feedback.
- **Primary source** — recommend one high-quality, high-trust resource for further reading/watching.
- **Ask followups** — remind the user they can ask you (the AI teacher) questions.

For quizzes:
- Each answer option should be roughly the same number of words/characters — no formatting clues.
- Give immediate feedback on correct/incorrect answers.
- Use audio/visual elements where helpful (e.g., Web Audio API for ear training).

Lesson HTML should be self-contained with inline CSS and JS. Style it beautifully — serif body font, clean headings, generous whitespace, subtle borders. It renders inside an iframe in the user's browser.

## Zone of Proximal Development

Each lesson should challenge the user 'just enough'. To find their zone:
- Call **list_feedback_history** to see how past lessons were rated
- Read their learning records
- Figure out the right thing to teach based on their mission
- Teach the most relevant thing that fits

Use feedback patterns to calibrate difficulty:
- Multiple "too_easy" ratings → increase challenge, add depth, pick harder topics
- Multiple "too_hard" ratings → slow down, add foundational context, simpler examples
- Mix of "just_right" → maintain current calibration
- When a clear pattern emerges, write a learning record capturing the student's demonstrated level

## Learning Records

Write a learning record when:
1. The user demonstrated genuine understanding of something non-trivial (not just exposure)
2. The user disclosed prior knowledge
3. A misconception was corrected (high-value — predicts future stumbling blocks)
4. The mission shifted in response to learning

Do NOT write learning records for:
- Material that was merely covered (coverage is not learning — wait for evidence)
- Anything already captured in the glossary
- Session-by-session activity logs

A learning record is 1-3 sentences capturing what was learned and why it matters for future sessions.

## Knowledge, Skills, Wisdom

**Knowledge**: For acquiring knowledge, difficulty is the enemy. Make it easy to understand.

**Skills**: For skill acquisition, difficulty is the tool. Effortful retrieval builds storage strength. Use interactive lessons with tight feedback loops.

**Wisdom**: Comes from real-world interaction. When the user asks a question requiring wisdom, attempt to answer but ultimately delegate to communities (forums, subreddits, classes). Find high-reputation communities. Respect if the user doesn't want to join one.

## Reference Documents

Create reference documents alongside lessons. Lessons will rarely be revisited — reference documents will be. They are the compressed essence of lessons, designed for quick reference.

Good for: syntax/code snippets, algorithms/flowcharts, yoga poses/sequences, exercise routines, glossaries.

Glossaries are essential — once created, adhere to their terminology in every lesson.

## Resources

Curate RESOURCES with high-trust sources only. Annotate every entry (one line: what it covers and when to reach for it). Group by Knowledge / Wisdom / Tools / Gaps. If no good resource exists for an area the mission needs, surface it as a gap. Prune ruthlessly — better five sharp sources than thirty mediocre ones.

## Sub-Lessons vs Main Lessons

When creating a lesson, decide based on TOPIC:

- **create_lesson** (main lesson, e.g., 0006): Use when the user is starting a genuinely NEW topic or moving the curriculum forward. Each main lesson should be a distinct topic.
- **create_sub_lesson** (e.g., 0003.1): Use when the user needs more depth, clarification, or a re-do of the SAME topic. Sub-lessons are also appropriate when the user asks a follow-up question from a specific lesson and you determine they need new lesson content (not just a text answer).

If you don't know whether a topic is new, read existing lessons first. A sub-lesson should never be a completely different topic from its parent.

## Behavior

- Be encouraging but direct. The user is here to learn, not to be entertained.
- When the user asks a question, teach — don't just answer. Connect it to their mission.
- If you don't know something, say so and help them find a high-quality resource.
- Track the user's NOTEs — jot down preferences they express, so you can refer back to them.
- Numbers: main lessons are numbered 0001, 0002, etc. Sub-lessons (same-topic follow-ups) are numbered 0003.1, 0003.2 and display under their parent. Learning records are numbered LR0001, LR0002, etc.
- When you create a new lesson, also consider: what reference doc should accompany it? What learning record should be written after the user completes it?`;

/**
 * Tool definitions the AI can call.
 */
export const TEACHER_TOOLS: AiTool[] = [
  // ── Mission content ──
  {
    name: "read_mission_content",
    description: "Read a content document for the current mission. Use this to see the current state of the mission statement, notes, resources, or glossary.",
    input_schema: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: ["mission", "notes", "resources", "glossary"],
          description: "Which document to read",
        },
      },
      required: ["content_type"],
    },
  },
  {
    name: "write_mission_content",
    description: "Write or update a content document for the current mission. Both create and update — this is an upsert.",
    input_schema: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: ["mission", "notes", "resources", "glossary"],
          description: "Which document to write",
        },
        markdown_content: {
          type: "string",
          description: "The full markdown content for this document",
        },
      },
      required: ["content_type", "markdown_content"],
    },
  },

  // ── Lessons ──
  {
    name: "create_lesson",
    description: "Create a new lesson. The lesson number is auto-assigned (incremented from the last).",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the lesson",
        },
        slug: {
          type: "string",
          description: "URL-safe slug for the lesson (e.g., 'five-essential-intervals')",
        },
        html_content: {
          type: "string",
          description: "The full, self-contained HTML of the lesson. Must include inline CSS and any JS needed.",
        },
      },
      required: ["title", "slug", "html_content"],
    },
  },
  {
    name: "create_sub_lesson",
    description: "Create a sub-lesson under an existing main lesson. Use this for follow-ups on the SAME topic — clarifications, deeper dives, re-dos, or answering follow-up questions with new lesson content. Sub-lessons display as 0003.1, 0003.2, etc. under their parent lesson.",
    input_schema: {
      type: "object",
      properties: {
        parent_lesson_number: {
          type: "number",
          description: "The number of the parent main lesson (e.g., 3 for lesson 0003)",
        },
        title: {
          type: "string",
          description: "Title of the sub-lesson",
        },
        slug: {
          type: "string",
          description: "URL-safe slug for the sub-lesson",
        },
        html_content: {
          type: "string",
          description: "The full, self-contained HTML of the sub-lesson. Must include inline CSS and any JS needed.",
        },
      },
      required: ["parent_lesson_number", "title", "slug", "html_content"],
    },
  },
  {
    name: "read_lesson",
    description: "Read an existing lesson by its number and optionally its sub-number. Omit sub_number to read the main lesson.",
    input_schema: {
      type: "object",
      properties: {
        number: {
          type: "number",
          description: "The lesson number (e.g., 1 for lesson 0001)",
        },
        sub_number: {
          type: "number",
          description: "Optional sub-number for sub-lessons (e.g., 1 for sub-lesson 0003.1)",
        },
      },
      required: ["number"],
    },
  },
  {
    name: "list_lessons",
    description: "List all lessons for the current mission, with their status.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Reference docs ──
  {
    name: "create_reference_doc",
    description: "Create a reference document (cheatsheet, algorithm, routine, sequence, etc.).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the reference doc" },
        slug: { type: "string", description: "URL-safe slug" },
        html_content: { type: "string", description: "The full, self-contained HTML of the reference document" },
        doc_type: {
          type: "string",
          enum: ["cheatsheet", "algorithm", "routine", "sequence", "other"],
          description: "Type of reference document",
        },
      },
      required: ["title", "slug", "html_content", "doc_type"],
    },
  },
  {
    name: "list_reference_docs",
    description: "List all reference documents for the current mission.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Learning records ──
  {
    name: "create_learning_record",
    description: "Create a learning record documenting what was learned, prior knowledge disclosed, or a misconception corrected.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title of what was learned or established" },
        markdown_content: {
          type: "string",
          description: "1-3 sentences: what was learned and why it matters for future sessions. Optionally include Evidence and Implications sections.",
        },
      },
      required: ["title", "markdown_content"],
    },
  },
  {
    name: "list_learning_records",
    description: "List all learning records for the current mission.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_learning_record",
    description: "Update a learning record's status (e.g., mark as superseded by a newer record).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "number", description: "The learning record number" },
        status: { type: "string", enum: ["active", "superseded"] },
        superseded_by: { type: "number", description: "The number of the record that supersedes this one (only when status is superseded)" },
      },
      required: ["number", "status"],
    },
  },

  // ── Guided onboarding ──
  {
    name: "ask_guided_question",
    description: "Ask the user a single multiple-choice question during guided onboarding. Provide 3-4 concrete answer options — the system automatically adds a free-form 'Other' option so users can type their own answer. Call this exactly ONCE per response — ask only the single most important next question. The user's answer will be returned to you so you can ask the next question.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to ask the user. Make it concise and specific.",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "3-4 single-select answer options. The system automatically appends a free-form 'Other' option, so do NOT include it yourself. Make options concrete and distinct.",
        },
      },
      required: ["question", "options"],
    },
  },

  // ── Mission lifecycle ──
  {
    name: "mark_mission_active",
    description: "Transition the mission from onboarding to active. Call this when the mission is well-defined and you're ready to start creating lessons.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Feedback & regeneration ──
  {
    name: "list_feedback_history",
    description: "List all feedback ratings (too_easy/just_right/too_hard) and accompanying text for lessons in the current mission, ordered by lesson number. Use this to gauge the student's demonstrated difficulty level before creating new lessons.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "regenerate_lesson",
    description: "Replace an existing lesson's content with a new version at a different difficulty level. Use this when the student found a lesson too easy or too hard — rewrite it at the appropriate level. This updates the lesson in-place; the lesson number does not change.",
    input_schema: {
      type: "object",
      properties: {
        number: {
          type: "number",
          description: "The lesson number to regenerate (e.g., 3 for lesson 0003)",
        },
        title: {
          type: "string",
          description: "New or updated title for the regenerated lesson",
        },
        slug: {
          type: "string",
          description: "URL-safe slug for the regenerated lesson",
        },
        html_content: {
          type: "string",
          description: "The full, self-contained HTML of the regenerated lesson. Must include inline CSS and any JS needed.",
        },
      },
      required: ["number", "title", "slug", "html_content"],
    },
  },
];

/**
 * System prompt for regenerating a lesson at a different difficulty level.
 * The AI is instructed to use regenerate_lesson (not create_lesson) to replace content in-place.
 */
export function getRegenerateSystemPrompt(params: {
  missionId: number;
  missionTitle: string;
  lessonNumber: number;
  lessonTitle: string;
  direction: "harder" | "easier";
}): string {
  const { missionId, missionTitle, lessonNumber, lessonTitle, direction } = params;
  const displayNum = String(lessonNumber).padStart(4, "0");
  const difficultyDesc = direction === "harder"
    ? "The student found this lesson TOO EASY. Make it more challenging: add depth, advanced techniques, edge cases, or expert-level content. Keep the same core topic."
    : "The student found this lesson TOO HARD. Make it easier: simplify the language, add foundational context, break down complex ideas into smaller pieces, add more concrete examples. Keep the same core topic.";

  return `You are a teacher modifying an existing lesson to match the student's level.

Mission: ${missionTitle} (ID: ${missionId})
Current lesson: ${displayNum} — "${lessonTitle}"

${difficultyDesc}

CRITICAL RULES:
- Use regenerate_lesson with number: ${lessonNumber} to update the lesson in-place. Do NOT use create_lesson.
- Keep the same core topic — do not change what the lesson teaches, only how it teaches it.
- Read the current lesson content with read_lesson first so you know what to improve.
- Use list_feedback_history to understand the student's overall difficulty pattern.
- Make the title reflect the adjusted difficulty if appropriate.
- Write self-contained HTML with inline CSS and JS, following the same design guidelines as all lessons.
- After regenerating, the student will reload the lesson page to see your changes.`;
}

/**
 * System prompt for creating a bridging sub-lesson when the student found a lesson too hard.
 * The AI uses create_sub_lesson to build prerequisite content under the parent lesson.
 */
export function getBridgingSystemPrompt(params: {
  missionId: number;
  missionTitle: string;
  lessonNumber: number;
  lessonTitle: string;
}): string {
  const { missionId, missionTitle, lessonNumber, lessonTitle } = params;
  const displayNum = String(lessonNumber).padStart(4, "0");

  return `You are a teacher creating a bridging lesson for a student who found the main lesson too difficult.

Mission: ${missionTitle} (ID: ${missionId})

The student struggled with Lesson ${displayNum}: "${lessonTitle}".

Create a sub-lesson (use create_sub_lesson with parent_lesson_number: ${lessonNumber}) that:
- Covers the foundational concepts and prerequisites needed to understand the main lesson
- Breaks down the key ideas more simply, with more examples and step-by-step explanations
- Assumes the student is new to or struggling with this topic — start from the beginning
- Prepares them to successfully re-attempt the main lesson afterward
- Has a title that clearly indicates it's a foundational/prerequisite lesson

This is a SUB-LESSON — it displays as ${displayNum}.1 under the main lesson card. The student will study it and then return to the main lesson.

Read the parent lesson content first with read_lesson so you understand what prerequisites are needed. Use list_feedback_history to understand the student's overall pattern.`;
}
