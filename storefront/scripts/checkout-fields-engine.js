/**
 * Checkout Fields engine: the field schema, definition checks and shopper value validation.
 *
 * One dependency-free module, free of DOM and Node APIs, shared by:
 *   - the storefront kit (renders fields, checks values before the order is placed);
 *   - the Admin page (checks definitions, runs the live form preview);
 *   - the App Builder actions (the definitions feed, saving values and the place-order webhook),
 *     which import it as `#engine`.
 *
 * Because the same code runs in the browser and on the server, a shopper sees exactly the errors
 * the server would return, and the server never trusts the browser's checks.
 */

export const FIELD_TYPES = ['text', 'textarea', 'select', 'checkbox', 'date'];
export const PLACEMENTS = ['shipping', 'payment', 'review'];
export const CONDITION_OPERATORS = [
  'eq', 'neq', 'in', 'not_in', 'filled', 'empty', 'checked', 'unchecked',
];
export const MATCH_MODES = ['all', 'any'];

export const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const STORE_CODE_PATTERN = /^[a-z0-9_]{1,64}$/i;
export const GROUP_ID_PATTERN = /^\d{1,9}$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE_DATE = /^today(?:([+-])(\d{1,4}))?$/;

/** The customer group Commerce uses for shoppers who aren't signed in. */
export const GUEST_GROUP = '0';

/** Hard limits, whatever a definition says. They also bound the cost of merchant regexes. */
export const MAX_FIELDS = 50;
export const MAX_VALUE_LENGTH = 2000;
export const MAX_LABEL_LENGTH = 120;
export const MAX_TEXT_LENGTH = 255;
export const MAX_OPTIONS = 100;
export const MAX_CONDITIONS = 10;
export const MAX_PATTERN_LENGTH = 200;
export const MAX_DAYS = 3650;

const DAY_MS = 86_400_000;
const NO_VALUE_OPERATORS = ['filled', 'empty', 'checked', 'unchecked'];
const LIST_OPERATORS = ['in', 'not_in'];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isWhole(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Splits "a, b,c" or ["a","b"] into trimmed, non-empty strings. */
export function toList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------------------------------ */
/* Patterns and dates                                                                          */
/* ------------------------------------------------------------------------------------------ */

// A group with a quantifier inside, quantified again: (a+)+, (\w*)*, (x+){2,}. These are the
// classic catastrophic-backtracking shapes, so merchant patterns may not use them.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[*+}](?:[^()\\]|\\.)*\)\s*[*+{]/;
const BACKREFERENCE = /\\[1-9]|\\k</;

/** Why a merchant regex can't be used, or null when it's fine. */
export function patternProblem(pattern) {
  if (!isString(pattern) || pattern === '') {
    return 'pattern must be a non-empty string';
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return `pattern must be at most ${MAX_PATTERN_LENGTH} characters`;
  }
  if (NESTED_QUANTIFIER.test(pattern) || BACKREFERENCE.test(pattern)) {
    return 'pattern must not nest quantifiers or use backreferences';
  }
  try {
    RegExp(pattern, 'u');
  } catch {
    return 'pattern is not a valid regular expression';
  }
  return null;
}

/** Compiles a pattern anchored to the whole value. Returns null for unusable patterns. */
export function compilePattern(pattern) {
  if (patternProblem(pattern)) {
    return null;
  }
  return new RegExp(`^(?:${pattern})$`, 'u');
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value) {
  if (!isString(value) || !ISO_DATE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Today's date (YYYY-MM-DD) in UTC, or in a time zone when given. */
export function today(now = Date.now(), timeZone = undefined) {
  if (timeZone) {
    try {
      // en-CA formats dates as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', {
        day: '2-digit', month: '2-digit', timeZone, year: 'numeric',
      }).format(new Date(now));
    } catch {
      // Unknown time zone: fall back to UTC.
    }
  }
  return new Date(now).toISOString().slice(0, 10);
}

export function isDateSpec(spec) {
  if (!isString(spec)) {
    return false;
  }
  if (isIsoDate(spec)) {
    return true;
  }
  const match = RELATIVE_DATE.exec(spec);
  return Boolean(match) && (!match[2] || Number(match[2]) <= MAX_DAYS);
}

/** Turns a date limit (YYYY-MM-DD, "today", "today+3", "today-1") into a date. */
export function resolveDate(spec, todayDate) {
  if (isIsoDate(spec)) {
    return spec;
  }
  const match = RELATIVE_DATE.exec(spec ?? '');
  if (!match) {
    return null;
  }
  const days = match[2] ? Number(match[2]) * (match[1] === '-' ? -1 : 1) : 0;
  const base = new Date(`${todayDate}T00:00:00Z`).getTime();
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------------------------------ */
/* Definitions                                                                                 */
/* ------------------------------------------------------------------------------------------ */

function checkText(errors, field, key, max) {
  const value = field[key];
  if (value !== undefined && value !== null && (!isString(value) || value.length > max)) {
    errors.push(`${key} must be text of at most ${max} characters`);
  }
}

function checkLengths(errors, validation) {
  const { minLength, maxLength } = validation;
  if (minLength !== undefined && !(isWhole(minLength) && minLength <= MAX_VALUE_LENGTH)) {
    errors.push(`minLength must be a whole number from 0 to ${MAX_VALUE_LENGTH}`);
  }
  if (maxLength !== undefined && !(isWhole(maxLength) && maxLength >= 1
    && maxLength <= MAX_VALUE_LENGTH)) {
    errors.push(`maxLength must be a whole number from 1 to ${MAX_VALUE_LENGTH}`);
  }
  if (isWhole(minLength) && isWhole(maxLength) && minLength > maxLength) {
    errors.push('minLength must not be more than maxLength');
  }
}

function checkValidation(errors, field) {
  const { validation, type } = field;
  if (validation === undefined) {
    return;
  }
  if (!isObject(validation)) {
    errors.push('validation must be an object');
    return;
  }
  if (type === 'text' || type === 'textarea') {
    checkLengths(errors, validation);
    if (validation.pattern !== undefined && validation.pattern !== '') {
      const problem = patternProblem(validation.pattern);
      if (problem) {
        errors.push(problem);
      }
    }
    checkText(errors, validation, 'patternMessage', MAX_TEXT_LENGTH);
  }
  if (type === 'date') {
    ['minDate', 'maxDate'].forEach((key) => {
      const spec = validation[key];
      if (spec !== undefined && spec !== '' && !isDateSpec(spec)) {
        errors.push(`${key} must be YYYY-MM-DD, "today" or "today+N" / "today-N" days`);
      }
    });
    const { minDate, maxDate } = validation;
    if (isIsoDate(minDate) && isIsoDate(maxDate) && minDate > maxDate) {
      errors.push('minDate must not be after maxDate');
    }
  }
}

function checkOptions(errors, field) {
  if (field.type !== 'select') {
    if (field.options !== undefined && !(Array.isArray(field.options)
      && field.options.length === 0)) {
      errors.push('only select fields have options');
    }
    return;
  }
  const { options } = field;
  if (!Array.isArray(options) || options.length === 0 || options.length > MAX_OPTIONS) {
    errors.push(`a select field needs 1 to ${MAX_OPTIONS} options`);
    return;
  }
  const seen = new Set();
  options.forEach((option, index) => {
    if (!isObject(option) || !isString(option.value) || option.value.trim() === ''
      || option.value.length > MAX_LABEL_LENGTH) {
      errors.push(`option ${index + 1} needs a value of 1 to ${MAX_LABEL_LENGTH} characters`);
      return;
    }
    if (option.label !== undefined && !(isString(option.label)
      && option.label.length <= MAX_LABEL_LENGTH)) {
      errors.push(`option ${index + 1} label must be at most ${MAX_LABEL_LENGTH} characters`);
    }
    if (seen.has(option.value)) {
      errors.push(`option value "${option.value}" is used twice`);
    }
    seen.add(option.value);
  });
}

function checkDefault(errors, field) {
  const value = field.default;
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (field.type === 'checkbox') {
    if (typeof value !== 'boolean') {
      errors.push('default must be true or false for a checkbox');
    }
    return;
  }
  if (!isString(value) || value.length > MAX_VALUE_LENGTH) {
    errors.push('default must be text');
    return;
  }
  if (field.type === 'select' && Array.isArray(field.options)
    && !field.options.some((option) => option?.value === value)) {
    errors.push('default must be one of the options');
  }
  if (field.type === 'date' && !isIsoDate(value)) {
    errors.push('default must be a date (YYYY-MM-DD)');
  }
}

function checkScope(errors, field) {
  const { scope } = field;
  if (scope === undefined) {
    return;
  }
  if (!isObject(scope)) {
    errors.push('scope must be an object');
    return;
  }
  const { storeViews = [], customerGroups = [] } = scope;
  if (!Array.isArray(storeViews)
    || !storeViews.every((code) => isString(code) && STORE_CODE_PATTERN.test(code))) {
    errors.push('scope.storeViews must be a list of store view codes');
  }
  if (!Array.isArray(customerGroups)
    || !customerGroups.every((id) => GROUP_ID_PATTERN.test(String(id)))) {
    errors.push('scope.customerGroups must be a list of customer group IDs');
  }
}

function checkConditions(errors, field, codes) {
  const { conditions } = field;
  if (conditions === undefined) {
    return;
  }
  if (!Array.isArray(conditions) || conditions.length > MAX_CONDITIONS) {
    errors.push(`conditions must be a list of at most ${MAX_CONDITIONS}`);
    return;
  }
  if (field.match !== undefined && !MATCH_MODES.includes(field.match)) {
    errors.push('match must be "all" or "any"');
  }
  conditions.forEach((condition, index) => {
    const at = `condition ${index + 1}`;
    if (!isObject(condition)) {
      errors.push(`${at} must be an object`);
      return;
    }
    if (!isString(condition.field) || !CODE_PATTERN.test(condition.field)) {
      errors.push(`${at} needs the code of another field`);
    } else if (condition.field === field.code) {
      errors.push(`${at} can't depend on the field itself`);
    } else if (codes && !codes.has(condition.field)) {
      errors.push(`${at} refers to unknown field "${condition.field}"`);
    }
    if (!CONDITION_OPERATORS.includes(condition.operator)) {
      errors.push(`${at} has an unknown operator`);
    } else if (!NO_VALUE_OPERATORS.includes(condition.operator)) {
      const { value } = condition;
      const ok = LIST_OPERATORS.includes(condition.operator)
        ? toList(value).length > 0
        : (isString(value) && value !== '') || typeof value === 'number';
      if (!ok) {
        errors.push(`${at} needs a value`);
      }
    }
  });
}

/**
 * Checks one field definition. `codes` (a Set of every field code) lets conditions be checked
 * against the other fields. Returns a list of problems; empty means the field is valid.
 */
export function validateField(field, { codes } = {}) {
  if (!isObject(field)) {
    return ['field must be an object'];
  }
  const errors = [];
  if (!isString(field.code) || !CODE_PATTERN.test(field.code)) {
    errors.push('code must start with a letter and use only a-z, 0-9 and _ (at most 64)');
  }
  if (!isString(field.label) || field.label.trim() === ''
    || field.label.length > MAX_LABEL_LENGTH) {
    errors.push(`label must be 1 to ${MAX_LABEL_LENGTH} characters`);
  }
  if (!FIELD_TYPES.includes(field.type)) {
    errors.push(`type must be one of ${FIELD_TYPES.join(', ')}`);
  }
  if (field.placement !== undefined && !PLACEMENTS.includes(field.placement)) {
    errors.push(`placement must be one of ${PLACEMENTS.join(', ')}`);
  }
  ['required', 'enabled', 'showInEmail'].forEach((key) => {
    if (field[key] !== undefined && typeof field[key] !== 'boolean') {
      errors.push(`${key} must be true or false`);
    }
  });
  if (field.sortOrder !== undefined && !Number.isFinite(field.sortOrder)) {
    errors.push('sortOrder must be a number');
  }
  checkText(errors, field, 'placeholder', MAX_TEXT_LENGTH);
  checkText(errors, field, 'help', MAX_TEXT_LENGTH);
  checkValidation(errors, field);
  checkOptions(errors, field);
  checkDefault(errors, field);
  checkScope(errors, field);
  checkConditions(errors, field, codes);
  return errors;
}

/** Codes of fields whose conditions loop back to themselves (a needs b, b needs a). */
function findCycles(fields) {
  const needs = new Map(fields.map((field) => [
    field.code,
    (field.conditions ?? []).map((condition) => condition?.field),
  ]));
  const looping = new Set();
  const visit = (code, path) => {
    if (path.includes(code)) {
      path.slice(path.indexOf(code)).forEach((item) => looping.add(item));
      return;
    }
    (needs.get(code) ?? []).forEach((next) => visit(next, [...path, code]));
  };
  fields.forEach((field) => visit(field.code, []));
  return looping;
}

/**
 * Checks a whole set of definitions: each field, duplicate codes, conditions that refer to
 * missing fields and conditions that loop. Problems are prefixed with the field's code.
 */
export function validateDefinitions(fields) {
  if (!Array.isArray(fields)) {
    return ['fields must be a list'];
  }
  if (fields.length > MAX_FIELDS) {
    return [`at most ${MAX_FIELDS} fields are allowed`];
  }
  const codes = new Set();
  const errors = [];
  fields.forEach((field, index) => {
    const name = isString(field?.code) && field.code ? field.code : `field ${index + 1}`;
    if (codes.has(field?.code)) {
      errors.push(`${name}: code is used by another field`);
    }
    codes.add(field?.code);
  });
  fields.forEach((field, index) => {
    const name = isString(field?.code) && field.code ? field.code : `field ${index + 1}`;
    validateField(field, { codes }).forEach((error) => errors.push(`${name}: ${error}`));
  });
  findCycles(fields.filter(isObject)).forEach((code) => {
    errors.push(`${code}: its conditions depend on each other in a loop`);
  });
  return errors;
}

/* ------------------------------------------------------------------------------------------ */
/* Which fields a shopper sees                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Fields in display order: placement (shipping, payment, review), then sortOrder, then code. */
export function sortFields(fields) {
  const placementIndex = (field) => {
    const index = PLACEMENTS.indexOf(field.placement ?? 'review');
    return index < 0 ? PLACEMENTS.length : index;
  };
  return [...fields].sort((a, b) => placementIndex(a) - placementIndex(b)
    || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    || String(a.code).localeCompare(String(b.code)));
}

/** True when the field applies to this store view and customer group (empty lists mean all). */
export function inScope(field, { storeView, customerGroup } = {}) {
  const storeViews = field.scope?.storeViews ?? [];
  const groups = (field.scope?.customerGroups ?? []).map(String);
  if (storeViews.length && storeView !== undefined && !storeViews.includes(storeView)) {
    return false;
  }
  if (groups.length && !groups.includes(String(customerGroup ?? GUEST_GROUP))) {
    return false;
  }
  return true;
}

/** The enabled, valid fields for a store view and customer group, in display order. */
export function fieldsFor(fields, context = {}) {
  if (!Array.isArray(fields)) {
    return [];
  }
  const codes = new Set(fields.map((field) => field?.code));
  return sortFields(fields.filter((field) => isObject(field)
    && field.enabled !== false
    && validateField(field, { codes }).length === 0
    && inScope(field, context)));
}

const PUBLIC_KEYS = [
  'code', 'label', 'type', 'placement', 'required', 'sortOrder', 'placeholder', 'help',
  'default', 'options', 'validation', 'scope', 'conditions', 'match',
];

/**
 * The definitions the storefront needs, without internal fields (database IDs, timestamps,
 * email settings). Filtered by store view when one is given; customer groups stay in the
 * response so the kit can pick the shopper's fields after sign-in without another request.
 */
export function publicFields(fields, { storeView } = {}) {
  if (!Array.isArray(fields)) {
    return [];
  }
  const codes = new Set(fields.map((field) => field?.code));
  return sortFields(fields.filter((field) => isObject(field)
    && field.enabled !== false
    && validateField(field, { codes }).length === 0
    && inScope({ scope: { storeViews: field.scope?.storeViews } }, { storeView })))
    .map((field) => Object.fromEntries(PUBLIC_KEYS
      .filter((key) => field[key] !== undefined)
      .map((key) => [key, field[key]])));
}

function isFilled(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function testCondition(condition, value) {
  const text = value === undefined || value === null ? '' : String(value);
  switch (condition.operator) {
    case 'eq': return text === String(condition.value);
    case 'neq': return text !== String(condition.value);
    case 'in': return toList(condition.value).includes(text);
    case 'not_in': return !toList(condition.value).includes(text);
    case 'filled': return isFilled(value);
    case 'empty': return !isFilled(value);
    case 'checked': return value === true;
    case 'unchecked': return value !== true;
    default: return false;
  }
}

/**
 * Which of `fields` are shown, given the shopper's current values. A field with conditions is
 * shown when they match; a condition on a hidden field sees that field as empty, so hiding a
 * field also hides the fields that depend on it. `fields` should come from fieldsFor().
 */
export function visibleFields(fields, values = {}) {
  const byCode = new Map(fields.map((field) => [field.code, field]));
  const memo = new Map();
  const shown = (field, depth) => {
    if (memo.has(field.code)) {
      return memo.get(field.code);
    }
    if (depth > MAX_FIELDS) {
      return false;
    }
    const conditions = field.conditions ?? [];
    let result = true;
    if (conditions.length) {
      const results = conditions.map((condition) => {
        const other = byCode.get(condition.field);
        const visible = other ? shown(other, depth + 1) : false;
        return testCondition(condition, visible ? values[condition.field] : undefined);
      });
      result = field.match === 'any' ? results.some(Boolean) : results.every(Boolean);
    }
    memo.set(field.code, result);
    return result;
  };
  return fields.filter((field) => shown(field, 0));
}

/* ------------------------------------------------------------------------------------------ */
/* Shopper values                                                                              */
/* ------------------------------------------------------------------------------------------ */

const TRUE_WORDS = ['1', 'true', 'yes', 'on'];

/** Cleans one raw value: trimmed text, a boolean for checkboxes; undefined when empty. */
export function normaliseValue(field, raw) {
  if (field.type === 'checkbox') {
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (raw === undefined || raw === null || raw === '') {
      return false;
    }
    return TRUE_WORDS.includes(String(raw).trim().toLowerCase());
  }
  if (raw === undefined || raw === null || typeof raw === 'object') {
    return undefined;
  }
  const text = String(raw).replace(/\r\n?/g, '\n');
  const clean = field.type === 'textarea' ? text.trim() : text.replace(/\s+/g, ' ').trim();
  return clean === '' ? undefined : clean;
}

/** The field's starting value for a fresh form. */
export function defaultValue(field) {
  if (field.type === 'checkbox') {
    return field.default === true;
  }
  return isString(field.default) ? field.default : '';
}

/**
 * The problem with one value, as a message for the shopper, or null when it's fine.
 * `value` must already be normalised. `todayDate` (YYYY-MM-DD) anchors relative date limits.
 */
export function validateValue(field, value, { todayDate = today() } = {}) {
  const label = field.label || field.code;
  if (field.type === 'checkbox') {
    return field.required && value !== true ? `Please tick "${label}".` : null;
  }
  if (value === undefined || value === '') {
    return field.required ? `${label} is required.` : null;
  }
  if (!isString(value)) {
    return `${label} is not valid.`;
  }
  const validation = field.validation ?? {};
  if (field.type === 'select') {
    return (field.options ?? []).some((option) => option.value === value)
      ? null
      : `Choose one of the options for ${label}.`;
  }
  if (field.type === 'date') {
    if (!isIsoDate(value)) {
      return `Enter a valid date for ${label}.`;
    }
    const min = validation.minDate ? resolveDate(validation.minDate, todayDate) : null;
    const max = validation.maxDate ? resolveDate(validation.maxDate, todayDate) : null;
    if (min && value < min) {
      return `${label} must be on or after ${min}.`;
    }
    if (max && value > max) {
      return `${label} must be on or before ${max}.`;
    }
    return null;
  }
  const maxLength = Math.min(validation.maxLength ?? MAX_VALUE_LENGTH, MAX_VALUE_LENGTH);
  const { length } = [...value];
  if (validation.minLength && length < validation.minLength) {
    return `${label} must be at least ${validation.minLength} characters.`;
  }
  if (length > maxLength) {
    return `${label} must be at most ${maxLength} characters.`;
  }
  if (validation.pattern) {
    const regex = compilePattern(validation.pattern);
    if (regex && !regex.test(value)) {
      return validation.patternMessage || `${label} is not in the expected format.`;
    }
  }
  return null;
}

/**
 * Validates everything a shopper sent for the fields that apply to them.
 *
 * Only the fields in scope and currently shown are kept: values for hidden, unknown or
 * out-of-scope fields are dropped, so nothing the merchant didn't ask for reaches the order.
 *
 * @returns {{ valid: boolean, values: object, errors: object }} cleaned values and one error
 *   message per field code
 */
export function validateValues(fields, rawValues, options = {}) {
  const { storeView, customerGroup, todayDate = today() } = options;
  const raw = isObject(rawValues) ? rawValues : {};
  const applicable = fieldsFor(fields, { customerGroup, storeView });
  const cleaned = {};
  applicable.forEach((field) => {
    const value = normaliseValue(field, raw[field.code]);
    if (value !== undefined) {
      cleaned[field.code] = value;
    }
  });
  const values = {};
  const errors = {};
  visibleFields(applicable, cleaned).forEach((field) => {
    const value = cleaned[field.code];
    const error = validateValue(field, value, { todayDate });
    if (error) {
      errors[field.code] = error;
    } else if (value !== undefined && !(field.type === 'checkbox' && value === false)) {
      values[field.code] = value;
    }
  });
  return { errors, valid: Object.keys(errors).length === 0, values };
}

/* ------------------------------------------------------------------------------------------ */
/* Showing saved values                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** A saved value as text for people: option labels, Yes/No for checkboxes. */
export function formatValue(field, value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (field?.type === 'checkbox') {
    return value === true || TRUE_WORDS.includes(String(value).toLowerCase()) ? 'Yes' : 'No';
  }
  if (field?.type === 'select') {
    const option = (field.options ?? []).find((item) => item.value === value);
    return option?.label || String(value);
  }
  return String(value);
}

/**
 * Saved values as labelled rows for the Admin, order comments and emails, in field order.
 * Values whose field was deleted since keep their code as the label, so nothing is lost.
 */
export function describeValues(fields, values, { emailOnly = false } = {}) {
  const saved = isObject(values) ? values : {};
  const definitions = Array.isArray(fields) ? sortFields(fields.filter(isObject)) : [];
  const known = new Set(definitions.map((field) => field.code));
  const rows = definitions
    .filter((field) => saved[field.code] !== undefined)
    .filter((field) => !(emailOnly && field.showInEmail === false))
    .map((field) => ({
      code: field.code,
      label: field.label || field.code,
      value: formatValue(field, saved[field.code]),
    }));
  if (!emailOnly) {
    Object.keys(saved).filter((code) => !known.has(code)).sort().forEach((code) => {
      rows.push({ code, label: code, value: formatValue(undefined, saved[code]) });
    });
  }
  return rows.filter((row) => row.value !== '');
}

/* ------------------------------------------------------------------------------------------ */
/* Commerce custom attributes                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** How a value is stored as a Commerce custom attribute (always a string). */
export function toAttributeValue(value) {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return value === undefined || value === null ? '' : String(value);
}

/**
 * The `custom_attributes` input for `setCustomAttributesOnCart`: one entry per field that
 * applies to the shopper. Hidden fields are sent empty, so a value the shopper typed and then
 * hid (by changing another field) doesn't stay on the cart.
 *
 * @param {object[]} fields the shopper's fields, from fieldsFor()
 * @param {object} values the cleaned values, from validateValues().values
 */
export function toCustomAttributes(fields, values = {}) {
  return fields.map((field) => ({
    attribute_code: field.code,
    value: toAttributeValue(values[field.code]),
  }));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Reads custom attributes in any shape Commerce sends them: a JSON string, a list of
 * { attribute_code, value } (GraphQL, REST) or a plain { code: value } map (webhook payloads).
 * Returns a { code: string } map; empty values are left out.
 */
export function parseCustomAttributes(input, depth = 0) {
  let source = input;
  if (isString(source)) {
    source = parseJson(source);
  }
  const result = {};
  const add = (code, value) => {
    if (isString(code) && code !== '' && value !== undefined && value !== null
      && typeof value !== 'object' && String(value) !== '') {
      result[code] = String(value);
    }
  };
  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (isObject(item)) {
        add(item.attribute_code ?? item.code, item.value);
      }
    });
  } else if (isObject(source)) {
    Object.entries(source).forEach(([code, value]) => {
      if (isObject(value) && 'value' in value) {
        add(value.attribute_code ?? code, value.value);
      } else if ((isString(value) || Array.isArray(value)) && depth < 2
        && code === 'custom_attributes') {
        Object.assign(result, parseCustomAttributes(value, depth + 1));
      } else {
        add(code, value);
      }
    });
  }
  return result;
}
