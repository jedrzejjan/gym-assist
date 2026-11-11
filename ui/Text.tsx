import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, sizes } from './theme';

type Variant = 'body' | 'small' | 'title' | 'label';

const styles: Record<Variant, TextStyle> = {
  body: { fontFamily: fonts.regular, fontSize: sizes.body, color: colors.navy },
  small: { fontFamily: fonts.regular, fontSize: sizes.small, color: colors.slate },
  title: { fontFamily: fonts.semibold, fontSize: sizes.title, color: colors.navy },
  label: { fontFamily: fonts.regular, fontSize: sizes.small, color: colors.slate },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[styles[variant], style]} {...rest} />;
}
