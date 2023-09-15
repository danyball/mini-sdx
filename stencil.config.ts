import { Config } from '@stencil/core';
import { sass } from "@stencil/sass"

export const config: Config = {
  namespace: 'stencil-starter-project-name',
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'www',
      serviceWorker: null, // disable service workers
    },
  ],
  plugins: [
    sass({
      // These styles will be attached to *EVERY SINGLE* component
      injectGlobalPaths: ["src/scss/webcomponents.scss"],
    }),
  ],
  testing: {
    browserHeadless: "new",
  },
};
