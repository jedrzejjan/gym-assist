// PR titles become squash commits: <type>(<scope>): GYM-<n> <ticket name>
const jiraPlugin = require('./scripts/commitlint-jira-plugin');

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [jiraPlugin],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'ci', 'build', 'test', 'refactor', 'docs', 'chore', 'perf'],
    ],
    'scope-enum': [
      2,
      'always',
      ['log', 'clients', 'exercises', 'recovery', 'progress', 'db', 'import', 'design', 'infra'],
    ],
    'scope-empty': [2, 'never'],
    // Ticket names start with a capital letter ("GYM-12 Log set screen").
    'subject-case': [0],
    'subject-jira-key': [2, 'always'],
  },
};
