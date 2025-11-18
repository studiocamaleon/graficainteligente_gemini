const isDevelopment = import.meta.env.DEV;

export function useDebugLog(componentName: string) {
  const log = (message: string, data?: any) => {
    if (!isDevelopment) return;

    console.group(`🔍 [${componentName}] ${message}`);
    if (data !== undefined) {
      console.log(data);
    }
    console.groupEnd();
  };

  const logTable = (message: string, data: any[]) => {
    if (!isDevelopment) return;

    console.group(`📊 [${componentName}] ${message}`);
    console.table(data);
    console.groupEnd();
  };

  const logError = (message: string, error: any) => {
    if (!isDevelopment) return;

    console.group(`❌ [${componentName}] ${message}`);
    console.error(error);
    console.groupEnd();
  };

  return { log, logTable, logError };
}
