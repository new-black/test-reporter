import Zip from 'adm-zip'

export interface ReportInput {
  files: string[]
  createZip(): Zip
}

export interface InputProvider {
  load(): Promise<ReportInput>
  listTrackedFiles(): Promise<string[]>
}
