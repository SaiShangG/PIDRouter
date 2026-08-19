import type {
  OperationDto,
  PhaseDto,
  ProcedureDto,
  ProjectDto,
  UploadFileDto
} from '../../api/processAssistantTypes'

export const projectFixtures: ProjectDto[] = [
  {
    id: 1,
    name: 'Mock PID Project',
    jsonData: JSON.stringify({
      schemaVersion: 1,
      description: 'MSW Project fixture',
      fileIds: [1]
    })
  }
]

export const procedureFixtures: ProcedureDto[] = [
  {
    id: 1,
    name: 'Mock CIP Procedure',
    projectId: 1,
    jsonData: JSON.stringify({ schemaVersion: 1 })
  }
]

export const operationFixtures: OperationDto[] = [
  {
    id: 1,
    name: 'Mock Cleaning Sequence',
    index: 0,
    orderIndex: 0,
    procedureId: 1,
    jsonData: JSON.stringify({ schemaVersion: 1 })
  }
]

export const phaseFixtures: PhaseDto[] = [
  {
    id: 1,
    name: 'Mock Water Rinse',
    index: 0,
    orderIndex: 0,
    operationId: 1,
    jsonData: JSON.stringify({
      schemaVersion: 1,
      drawing: null,
      flowState: { flowPaths: [] },
      deviceStates: {}
    })
  }
]

export interface UploadFileFixture {
  metadata: UploadFileDto
  content: string
  contentType: string
}

export const uploadFileFixtures: UploadFileFixture[] = [
  {
    metadata: {
      id: 1,
      originalFileName: 'mock-pid.dxf',
      storedFileName: '1-mock-pid.dxf',
      url: '/api/v1/File/download/1-mock-pid.dxf',
      comment: JSON.stringify({
        name: 'Mock PID',
        drawingNumber: 'MOCK-001'
      }),
      fileSize: 36,
      uploadedAt: '2026-01-01T00:00:00.000Z'
    },
    content: '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n',
    contentType: 'application/dxf'
  }
]
