// commitlint rule: the subject must start with the Jira key, e.g. "GYM-12 Log set screen".
const JIRA_KEY = /^GYM-\d+ \S/;

module.exports = {
  rules: {
    'subject-jira-key': ({ subject }) => [
      JIRA_KEY.test(subject ?? ''),
      'subject must start with the Jira key, e.g. "GYM-12 Log set screen"',
    ],
  },
};
