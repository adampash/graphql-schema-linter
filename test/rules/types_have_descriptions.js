import assert from 'assert';
import { parse } from 'graphql';
import { visit, visitInParallel } from 'graphql/language/visitor';
import { validate } from 'graphql/validation';
import { buildASTSchema } from 'graphql/utilities/buildASTSchema';

import { TypesHaveDescriptions } from '../../src/rules/types_have_descriptions';

describe('TypesHaveDescriptions rule', () => {
  it('catches enum types that have no description', () => {
    const ast = parse(`
      # Query
      type QueryRoot {
        a: String
      }

      enum STATUS {
        DRAFT
        PUBLISHED
        HIDDEN
      }

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The enum type `STATUS` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 7, column: 7 }]);
  });

  it('catches scalar types that have no description', () => {
    const ast = parse(`
      # Query
      type QueryRoot {
        a: String
      }

      scalar DateTime

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The scalar type `DateTime` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 7, column: 7 }]);
  });

  it('catches object types that have no description', () => {
    const ast = parse(`
      type QueryRoot {
        a: String
      }

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The object type `QueryRoot` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 2, column: 7 }]);
  });

  it('catches input types that have no description', () => {
    const ast = parse(`
      # Query
      type QueryRoot {
        a: String
      }

      input AddStar {
        id: ID!
      }

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The input object type `AddStar` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 7, column: 7 }]);
  });

  it('catches interface types that have no description', () => {
    const ast = parse(`
      # The query root
      type QueryRoot {
        a: String
      }

      interface A {
        a: String
      }

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The interface type `A` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 7, column: 7 }]);
  });

  it('catches union types that have no description', () => {
    const ast = parse(`
      # The query root
      type QueryRoot {
        a: String
      }

      # A
      type A {
        a: String
      }

      # B
      type B {
        b: String
      }

      union AB = A | B

      schema {
        query: QueryRoot
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 1);

    assert.equal(errors[0].ruleName, 'types-have-descriptions');
    assert.equal(
      errors[0].message,
      'The union type `AB` is missing a description.'
    );
    assert.deepEqual(errors[0].locations, [{ line: 17, column: 7 }]);
  });

  it('ignores type extensions', () => {
    const ast = parse(`
      # The query root
      type Query {
        a: String
      }

      extend type Query {
        b: String
      }

      # Interface
      interface Vehicle {
        make: String!
      }

      extend type Vehicle {
        something: String!
      }
    `);

    const schema = buildASTSchema(ast);
    const errors = validate(schema, ast, [TypesHaveDescriptions]);

    assert.equal(errors.length, 0);
  });
});
