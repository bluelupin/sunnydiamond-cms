export default {
  routes: [
    {
      method: 'POST',
      path: '/careers/parse-resume',
      handler: 'resume-parser.parse',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/submissions-job-openings/submit',
      handler: 'submissions-job-opening.submit',
      config: {
        auth: false,
      },
    },
  ],
};
