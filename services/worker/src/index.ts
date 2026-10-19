export function run(): string {
  return 'comp_worker is running';
}

if (require.main === module) {
  console.log(run());
}
