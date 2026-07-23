function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const DESCRIPTION_LIMITS = {
  normal_description: 80,
  detailed_description: 400,
};

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

function validateOptionalDescription(value, fieldPath, maxLength) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldPath} must be a string when present`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldPath} must not be empty or whitespace-only`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    throw new Error(`${fieldPath} must not contain control characters`);
  }

  if ([...trimmed].length > maxLength) {
    throw new Error(`${fieldPath} must be ${maxLength} characters or fewer`);
  }

  return trimmed;
}

function validateStringArray(value, fieldPath) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array`);
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      throw new Error(`${fieldPath}[${index}] must be a string`);
    }
    if (entry.trim().length === 0) {
      throw new Error(`${fieldPath}[${index}] must not be empty or whitespace-only`);
    }
  }

  return value;
}

function validateCityAnswerSummaries(value, fieldPath) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array`);
  }

  const seenSourceIds = new Set();
  const seenSummaries = new Set();

  return value.map((entry, index) => {
    const entryPath = `${fieldPath}[${index}]`;

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${entryPath} must be an object`);
    }

    const keys = Object.keys(entry);
    const allowedKeys = new Set(["summary", "source_utterance_id"]);
    const unknownKeys = keys.filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new Error(`${entryPath} has unknown properties: ${unknownKeys.join(", ")}`);
    }

    if (!isNonEmptyString(entry.summary)) {
      throw new Error(`${entryPath}.summary must be a non-empty string`);
    }

    if (!isNonEmptyString(entry.source_utterance_id)) {
      throw new Error(`${entryPath}.source_utterance_id must be a non-empty string`);
    }

    if (seenSourceIds.has(entry.source_utterance_id)) {
      throw new Error(`${entryPath}.source_utterance_id must be unique`);
    }
    seenSourceIds.add(entry.source_utterance_id);

    if (seenSummaries.has(entry.summary)) {
      throw new Error(`${entryPath}.summary must be unique`);
    }
    seenSummaries.add(entry.summary);

    return {
      summary: entry.summary,
      source_utterance_id: entry.source_utterance_id,
    };
  });
}

export function validateAndNormalizeGeneralQuestionsDocument(raw, jsonPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${jsonPath} must be a JSON object`);
  }

  if (!isNonEmptyString(raw.diet_session_slug)) {
    throw new Error(`${jsonPath}.diet_session_slug must be a non-empty string`);
  }

  if (!Array.isArray(raw.questions)) {
    throw new Error(`${jsonPath}.questions must be an array`);
  }

  const questions = raw.questions.map((question, questionIndex) => {
    const questionPath = `${jsonPath}.questions[${questionIndex}]`;

    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`${questionPath} must be an object`);
    }

    if (!isNonEmptyString(question.slug)) {
      throw new Error(`${questionPath}.slug must be a non-empty string`);
    }

    if (!Array.isArray(question.items)) {
      throw new Error(`${questionPath}.items must be an array`);
    }

    if (
      question.topic_slugs !== undefined &&
      (!Array.isArray(question.topic_slugs) ||
        question.topic_slugs.some((slug) => !isNonEmptyString(slug)))
    ) {
      throw new Error(
        `${questionPath}.topic_slugs must be an array of non-empty strings when present`
      );
    }

    const items = question.items.map((item, itemIndex) => {
      const itemPath = `${questionPath}.items[${itemIndex}]`;

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`${itemPath} must be an object`);
      }

      if (!Number.isInteger(item.item_number) || item.item_number < 1) {
        throw new Error(`${itemPath}.item_number must be a positive integer`);
      }

      if (!isNonEmptyString(item.title)) {
        throw new Error(`${itemPath}.title must be a non-empty string`);
      }

      const normalDescription = validateOptionalDescription(
        item.normal_description,
        `${itemPath}.normal_description`,
        DESCRIPTION_LIMITS.normal_description
      );
      const detailedDescription = validateOptionalDescription(
        item.detailed_description,
        `${itemPath}.detailed_description`,
        DESCRIPTION_LIMITS.detailed_description
      );

      if (
        normalDescription !== null &&
        detailedDescription !== null &&
        normalDescription === detailedDescription
      ) {
        throw new Error(
          `${itemPath}.normal_description and detailed_description must not be identical`
        );
      }

      const subItems = validateStringArray(item.sub_items, `${itemPath}.sub_items`);

      const confirmedFactsRaw = item.confirmed_facts;
      const confirmedFacts =
        confirmedFactsRaw === undefined
          ? []
          : validateStringArray(confirmedFactsRaw, `${itemPath}.confirmed_facts`);

      const cityAnswerSummariesRaw = item.city_answer_summaries;
      const cityAnswerSummaries =
        cityAnswerSummariesRaw === undefined
          ? []
          : validateCityAnswerSummaries(
              cityAnswerSummariesRaw,
              `${itemPath}.city_answer_summaries`
            );

      return {
        ...item,
        normal_description: normalDescription,
        detailed_description: detailedDescription,
        sub_items: subItems,
        confirmed_facts: confirmedFacts,
        city_answer_summaries: cityAnswerSummaries,
      };
    });

    return {
      ...question,
      items,
      topic_slugs: question.topic_slugs ?? [],
    };
  });

  return {
    diet_session_slug: raw.diet_session_slug,
    questions,
  };
}
