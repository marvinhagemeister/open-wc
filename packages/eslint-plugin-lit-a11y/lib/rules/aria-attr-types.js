/**
 * @fileoverview aria-attr-types
 * @author open-wc
 */

const { aria } = require('aria-query');
const { TemplateAnalyzer } = require('../../template-analyzer/template-analyzer.js');
const { getAttrVal } = require('../utils/getAttrVal.js');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const errorMessage = (name, type, permittedValues) => {
  switch (type) {
    case 'tristate':
      return `The value for ${name} must be a boolean or the string "mixed".`;
    case 'token':
      return `The value for ${name} must be a single token from the following: ${permittedValues}.`;
    case 'tokenlist':
      return `The value for ${name} must be a list of one or more \
tokens from the following: ${permittedValues}.`;
    case 'idlist':
      return `The value for ${name} must be a list of strings that represent DOM element IDs (idlist)`;
    case 'id':
      return `The value for ${name} must be a string that represents a DOM element ID`;
    case 'boolean':
    case 'string':
    case 'integer':
    case 'number':
    default:
      return `The value for ${name} must be a ${type}.`;
  }
};

const extractTypeFromLiteral = value => {
  const normalizedStringValue = typeof value === 'string' && value.toLowerCase();
  if (normalizedStringValue === 'true' || normalizedStringValue === '') {
    return true;
  }

  if (normalizedStringValue === 'false') {
    return false;
  }

  return value;
};

// aria-hidden, boolean, []
const validityCheck = (value, expectedType, permittedValues) => {
  switch (expectedType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
    case 'id':
      return typeof value === 'string';
    case 'tristate':
      return typeof value === 'boolean' || value === 'mixed';
    case 'integer':
    case 'number':
      // Booleans resolve to 0/1 values so hard check that it's not first.
      // eslint-disable-next-line no-restricted-globals
      return typeof value !== 'boolean' && isNaN(Number(value)) === false;
    case 'token':
      return permittedValues.indexOf(typeof value === 'string' ? value.toLowerCase() : value) > -1;
    case 'idlist':
      return (
        typeof value === 'string' && value.split(' ').every(token => validityCheck(token, 'id', []))
      );
    case 'tokenlist':
      return (
        typeof value === 'string' &&
        value.split(' ').every(token => permittedValues.indexOf(token.toLowerCase()) > -1)
      );
    default:
      return false;
  }
};

module.exports = {
  validityCheck,
  meta: {
    docs: {
      description: 'aria-attr-types',
      category: 'Fill me in',
      recommended: false,
    },
    fixable: null, // or "code" or "whitespace"
    schema: [
      // fill in your schema
    ],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      TaggedTemplateExpression: node => {
        if (
          node.type === 'TaggedTemplateExpression' &&
          node.tag.type === 'Identifier' &&
          node.tag.name === 'html'
        ) {
          const analyzer = TemplateAnalyzer.create(node);

          analyzer.traverse({
            enterElement(element) {
              const ariaAttributes = Object.keys(element.attribs).filter(attr =>
                attr.startsWith('aria-'),
              );
              if (ariaAttributes.length > 0) {
                ariaAttributes.forEach(attr => {
                  const normalizedName = attr.toLowerCase();
                  // Not a valid aria-* state or property.
                  if (aria.get(normalizedName) === undefined) {
                    return;
                  }

                  const val = getAttrVal(element.attribs[attr]);
                  // Ignore the attribute if its value is null or undefined.
                  if (val === null || val === undefined) return;
                  if (val.startsWith('{{')) return;

                  // These are the attributes of the property/state to check against.
                  const attributes = aria.get(normalizedName);
                  const permittedType = attributes.type;
                  const allowUndefined = attributes.allowUndefined || false;
                  const permittedValues = attributes.values || [];
                  const isValid =
                    validityCheck(extractTypeFromLiteral(val), permittedType, permittedValues) ||
                    (allowUndefined && val === undefined);

                  if (isValid) {
                    return;
                  }

                  const loc = analyzer.getLocationForAttribute(element, attr);
                  context.report({
                    loc,
                    message: errorMessage(attr, permittedType, permittedValues),
                  });
                });
              }
            },
          });
        }
      },
    };
  },
};