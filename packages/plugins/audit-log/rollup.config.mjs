import { createBuildConfig } from '../../rollup.utils.mjs';

export default createBuildConfig({
  input: {
    server: './server/src/index.ts',
  },
  external: ['@strapi/strapi'],
});