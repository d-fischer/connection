import dfischer from '@d-fischer/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	globalIgnores(['lib', 'es']),
	{
		files: ['src/**/*.{ts,tsx}'],
		extends: [dfischer],

		languageOptions: {
			sourceType: 'module',

			parserOptions: {
				projectService: {
					allowDefaultProject: ['.prettierrc.js', 'eslint.config.mjs']
				}
			}
		}
	}
]);
