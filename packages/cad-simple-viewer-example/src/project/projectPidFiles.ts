export const isProjectPidFile = (fileName: string): boolean =>
  /\.pdi$/i.test(fileName.trim())
