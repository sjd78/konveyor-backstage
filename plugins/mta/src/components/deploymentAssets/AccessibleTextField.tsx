import { forwardRef, useId, type ComponentProps } from 'react';
import { Text, TextField } from '@backstage/ui';
import styles from './DeploymentAssetDialog.module.css';

export interface AccessibleTextFieldProps
  extends Omit<ComponentProps<typeof TextField>, 'description'> {
  /** Visible helper text. Also the input's accessible description. */
  helperText?: string;
  /** Visible error text, used instead of the helper text when invalid. */
  errorText?: string;
}

/**
 * BUI TextField whose helper or error text is also the input's accessible
 * description. While the field is valid, BUI links `description` itself. An
 * invalid field shows the error in a separate element, so this repeats that
 * element's id in `aria-describedby`. The visible layout is unchanged.
 */
export const AccessibleTextField = forwardRef<
  HTMLDivElement,
  AccessibleTextFieldProps
>(({ helperText, errorText, isInvalid, ...props }, ref) => {
  const errorId = useId();
  const showError = Boolean(isInvalid && errorText);
  return (
    <>
      <TextField
        {...props}
        ref={ref}
        isInvalid={isInvalid}
        description={isInvalid ? undefined : helperText}
        aria-describedby={showError ? errorId : undefined}
      />
      {showError ? (
        <Text
          as="p"
          variant="body-small"
          id={errorId}
          className={styles.fieldError}
        >
          {errorText}
        </Text>
      ) : null}
    </>
  );
});

AccessibleTextField.displayName = 'AccessibleTextField';
