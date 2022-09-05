const formatError = (error: any, contract: any) => {
  if (error.error?.data?.originalError?.data) {
    const errorDescription = contract.interface.parseError(error.error.data.originalError.data);
    return `${errorDescription.name} - ${errorDescription.args.join()}`;
    /* errors is formatted in this way in local network with hardhat */
  }
  if (error?.error?.data?.data?.data) {
    const errorDescription = contract.interface.parseError(error.error.data.data.data);
    return `${errorDescription.name} - ${errorDescription.args.join()}`;
  }
  return "Something wrong happened!";
};

export { formatError };
