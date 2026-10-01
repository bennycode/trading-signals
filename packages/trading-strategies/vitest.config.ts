import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from '../../vitest.shared.ts';

export default mergeConfig(baseConfig, defineConfig({}));
