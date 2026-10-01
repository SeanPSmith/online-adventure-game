export function resourcePrefix(projectName: string, environmentName: string): string {
  return `${projectName}-${environmentName}`;
}

export function stackSuffix(environmentName: string): string {
  return environmentName.charAt(0).toUpperCase() + environmentName.slice(1);
}
