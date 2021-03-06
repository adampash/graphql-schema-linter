const cosmiconfig = require('cosmiconfig');
import { readSync, readFileSync } from 'fs';
import getGraphQLProjectConfig from 'graphql-config';
import path from 'path';
import { sync as globSync, hasMagic as globHasMagic } from 'glob';

import { SourceMap } from './source_map.js';
import JSONFormatter from './formatters/json_formatter.js';
import TextFormatter from './formatters/text_formatter.js';

export class Configuration {
  /*
    options:
      - configDirectory: path to begin searching for config files
      - format: (required) `text` | `json`
      - rules: [string array] whitelist rules
      - schemaPaths: [string array] file(s) to read schema from
      - customRulePaths: [string array] path to additional custom rules to be loaded
      - stdin: [boolean] pass schema via stdin?
  */
  constructor(options = {}, stdinFd = null) {
    const defaultOptions = { format: 'text', customRulePaths: [] };
    const configOptions = loadOptionsFromConfig(options.configDirectory);

    // TODO Get configs from .graphqlconfig file

    this.options = Object.assign({}, defaultOptions, configOptions, options);
    this.stdinFd = stdinFd;
    this.schema = null;
    this.sourceMap = null;
    this.rules = null;
    this.rulePaths = this.options.customRulePaths.concat(
      path.join(__dirname, 'rules/*.js')
    );
  }

  getSchema() {
    if (this.schema) {
      return this.schema;
    }

    var schema;

    if (this.options.stdin) {
      this.schema = getSchemaFromFileDescriptor(this.stdinFd);
      this.sourceMap = new SourceMap({ stdin: this.schema });
    } else if (this.options.schemaPaths) {
      var expandedPaths = expandPaths(this.options.schemaPaths);
      var segments = getSchemaSegmentsFromFiles(expandedPaths);

      this.sourceMap = new SourceMap(segments);
      this.schema = this.sourceMap.getCombinedSource();
    }

    return this.schema;
  }

  getSchemaSourceMap() {
    if (!this.sourceMap) {
      this.getSchema();
    }

    return this.sourceMap;
  }

  getFormatter() {
    switch (this.options.format) {
      case 'json':
        return JSONFormatter;
      case 'text':
        return TextFormatter;
    }
  }

  getRules() {
    var rules = this.getAllRules();
    var specifiedRules;

    if (this.options.rules && this.options.rules.length > 0) {
      specifiedRules = this.options.rules.map(toUpperCamelCase);
      rules = this.getAllRules().filter(rule => {
        return specifiedRules.indexOf(rule.name) >= 0;
      });
    }

    // DEPRECATED - This code should be removed in v1.0.0.
    if (this.options.only && this.options.only.length > 0) {
      specifiedRules = this.options.only.map(toUpperCamelCase);
      rules = this.getAllRules().filter(rule => {
        return specifiedRules.indexOf(rule.name) >= 0;
      });
    }

    // DEPRECATED - This code should be removed in v1.0.0.
    if (this.options.except && this.options.except.length > 0) {
      specifiedRules = this.options.except.map(toUpperCamelCase);
      rules = this.getAllRules().filter(rule => {
        return specifiedRules.indexOf(rule.name) == -1;
      });
    }

    return rules;
  }

  getAllRules() {
    if (this.rules !== null) {
      return this.rules;
    }

    var expandedPaths = expandPaths(this.rulePaths);
    this.rules = [];
    expandedPaths.map(rulePath => {
      var rule = Object.values(require(rulePath));

      if (rule) {
        this.rules = this.rules.concat(rule);
      }
    });

    return this.rules;
  }

  validate() {
    const issues = [];

    const ruleNames = this.getAllRules().map(rule => rule.name);
    var misConfiguredRuleNames = []
      .concat(
        this.options.only || [],
        this.options.except || [],
        this.options.rules || []
      )
      .map(toUpperCamelCase)
      .filter(name => ruleNames.indexOf(name) == -1);

    if (this.getFormatter() == null) {
      issues.push({
        message: `The output format '${this.options.format}' is invalid`,
        field: 'format',
        type: 'error',
      });
    }

    if (misConfiguredRuleNames.length > 0) {
      issues.push({
        message: `The following rule(s) are invalid: ${misConfiguredRuleNames.join(
          ', '
        )}`,
        field: 'rules',
        type: 'warning',
      });
    }

    return issues;
  }
}

function loadOptionsFromConfig(configDirectory) {
  const searchPath = configDirectory || './';

  const cosmic = cosmiconfig('graphql-schema-linter', {
    cache: false,
    sync: true,
  }).load(searchPath);

  if (cosmic) {
    return {
      rules: cosmic.config.rules,
      customRulePaths: cosmic.config.customRulePaths || [],
    };
  } else {
    return {};
  }
}

function getSchemaFromFileDescriptor(fd) {
  var b = new Buffer(1024);
  var data = '';

  while (true) {
    var n = readSync(fd, b, 0, b.length);
    if (!n) {
      break;
    }
    data += b.toString('utf8', 0, n);
  }

  return data;
}

function getSchemaFromFile(path) {
  return readFileSync(path).toString('utf8');
}

function getSchemaSegmentsFromFiles(paths) {
  return paths.reduce((segments, path) => {
    segments[path] = getSchemaFromFile(path);
    return segments;
  }, {});
}

function expandPaths(pathOrPattern) {
  return (
    pathOrPattern
      .map(path => {
        if (globHasMagic(path)) {
          return globSync(path);
        } else {
          return path;
        }
      })
      .reduce((a, b) => {
        return a.concat(b);
      }, [])
      // Resolve paths to absolute paths so that including the same file
      // multiple times is not treated as different files
      .map(p => path.resolve(p))
  );
}

function toUpperCamelCase(string) {
  return string
    .split('-')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}
