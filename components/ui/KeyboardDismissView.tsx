import React, { ReactNode } from 'react';
import { TouchableWithoutFeedback, Keyboard, View, ViewStyle, StyleProp } from 'react-native';

interface KeyboardDismissViewProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * A wrapper component that dismisses the keyboard when tapping outside of inputs.
 * Wrap your screen content with this component to enable tap-to-dismiss behavior.
 */
export const KeyboardDismissView: React.FC<KeyboardDismissViewProps> = ({
    children,
    style
}) => {
    return (
        <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
        >
            <View style={[{ flex: 1 }, style]}>
                {children}
            </View>
        </TouchableWithoutFeedback>
    );
};

export default KeyboardDismissView;
