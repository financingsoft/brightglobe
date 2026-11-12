/**
 * EAS project linking is injected by the build environment.
 * Set EAS_PROJECT_ID after creating/linking the project with `eas init`.
 */
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...config,
    extra: {
      ...config.extra,
      ...(projectId
        ? {
            eas: {
              ...config.extra?.eas,
              projectId
            }
          }
        : {})
    }
  };
};
