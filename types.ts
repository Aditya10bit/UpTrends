// types.ts
import type { ColorValue } from 'react-native';

// At least 2 colors ka tuple, readonly
export type ColorTuple = readonly [ColorValue, ColorValue, ...ColorValue[]];
