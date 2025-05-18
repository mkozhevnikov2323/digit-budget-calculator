export const errorMessageHandler = (errorMessage: string) => {
  switch (errorMessage) {
    case 'Validation failed':
      return 'Неправильные почта или пароль';
    default:
      return errorMessage;
  }
};
