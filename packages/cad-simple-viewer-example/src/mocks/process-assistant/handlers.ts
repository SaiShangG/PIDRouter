import { http, HttpResponse } from 'msw'

import type {
  AddProjectDto,
  OperationDto,
  PhaseDto,
  ProcedureDto,
  ProjectDto} from '../../api/processAssistantTypes'
import { processAssistantMockStore } from './store'

const api = '*/api/v1'

const errorResponse = (status: number, message: string) =>
  HttpResponse.json({ message }, { status })

const parseId = (value: string | readonly string[] | undefined): number =>
  Number(Array.isArray(value) ? value[0] : value)

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0 && value <= 2147483647

const parseQueryId = (request: Request, name: string): number =>
  Number(new URL(request.url).searchParams.get(name))

const parseStoredFileName = (
  value: string | readonly string[] | undefined
): string => {
  const fileName = Array.isArray(value) ? value[0] : value
  if (!fileName) return ''
  try {
    return decodeURIComponent(fileName)
  } catch {
    return fileName
  }
}

const readDto = async <T extends object>(request: Request): Promise<T | null> => {
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as T
  } catch {
    return null
  }
}

export const processAssistantHandlers = [
  http.get(`${api}/Project`, () =>
    HttpResponse.json(processAssistantMockStore.listProjects())
  ),

  http.post(`${api}/Project/add-v2`, async ({ request }) => {
    const project = await readDto<AddProjectDto>(request)
    if (!project) return errorResponse(400, 'A valid project is required')
    return HttpResponse.json(processAssistantMockStore.addProjectV2(project))
  }),

  http.post(`${api}/Project`, async ({ request }) => {
    const project = await readDto<ProjectDto>(request)
    if (!project) return errorResponse(400, 'A valid project is required')
    return HttpResponse.json(processAssistantMockStore.createProject(project))
  }),

  http.get(`${api}/Project/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid project ID')
    const project = processAssistantMockStore.getProject(id)
    return project
      ? HttpResponse.json(project)
      : errorResponse(404, 'Project not found')
  }),

  http.put(`${api}/Project/:id`, async ({ params, request }) => {
    const id = parseId(params.id)
    const project = await readDto<ProjectDto>(request)
    if (!isPositiveInteger(id) || !project) {
      return errorResponse(400, 'A valid project is required')
    }
    return processAssistantMockStore.updateProject(id, project)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Project not found')
  }),

  http.delete(`${api}/Project/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid project ID')
    return processAssistantMockStore.deleteProject(id)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Project not found')
  }),

  http.get(`${api}/File`, () =>
    HttpResponse.json(processAssistantMockStore.listFiles())
  ),

  http.get(`${api}/File/download/:storedFileName`, async ({ params }) => {
    const storedFileName = parseStoredFileName(params.storedFileName)
    const content = await processAssistantMockStore.getFileContent(storedFileName)
    if (!content) return errorResponse(404, 'File not found')
    return new HttpResponse(content, {
      headers: {
        'Content-Type': content.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${storedFileName}"`
      }
    })
  }),

  http.get(`${api}/File/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid file ID')
    const file = processAssistantMockStore.getFile(id)
    return file
      ? HttpResponse.json(file)
      : errorResponse(404, 'File not found')
  }),

  http.post(`${api}/File/upload`, async ({ request }) => {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return errorResponse(400, 'Invalid multipart form data')
    }
    const file = formData.get('file')
    const comment = formData.get('comment')
    if (!file || typeof file === 'string') {
      return errorResponse(400, 'The file field is required')
    }
    if (comment !== null && typeof comment !== 'string') {
      return errorResponse(400, 'The comment field must be text')
    }
    return HttpResponse.json(
      processAssistantMockStore.createFile(file, comment ?? undefined),
      { status: 201 }
    )
  }),

  http.post(`${api}/File/upload-multiple`, async ({ request }) => {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return errorResponse(400, 'Invalid multipart form data')
    }
    const files = formData
      .getAll('files')
      .filter((value): value is File => typeof value !== 'string')
    if (files.length === 0) {
      return errorResponse(400, 'At least one files field is required')
    }
    return HttpResponse.json(
      files.map(file => processAssistantMockStore.createFile(file)),
      { status: 201 }
    )
  }),

  http.put(`${api}/File/:id/comment`, async ({ params, request }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid file ID')
    let comment: unknown
    try {
      comment = await request.json()
    } catch {
      return errorResponse(400, 'Comment must be a JSON string')
    }
    if (typeof comment !== 'string') {
      return errorResponse(400, 'Comment must be a JSON string')
    }
    return processAssistantMockStore.updateFileComment(id, comment)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'File not found')
  }),

  http.delete(`${api}/File/:storedFileName`, ({ params }) => {
    const storedFileName = parseStoredFileName(params.storedFileName)
    if (!storedFileName) return errorResponse(400, 'Invalid stored file name')
    return processAssistantMockStore.deleteFile(storedFileName)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'File not found')
  }),

  http.get(`${api}/Procedure`, ({ request }) => {
    const projectId = parseQueryId(request, 'projectId')
    return isPositiveInteger(projectId)
      ? HttpResponse.json(processAssistantMockStore.listProcedures(projectId))
      : errorResponse(400, 'A valid projectId is required')
  }),

  http.post(`${api}/Procedure`, async ({ request }) => {
    const procedure = await readDto<ProcedureDto>(request)
    const projectId = procedure?.projectId ?? 0
    if (!procedure || !isPositiveInteger(projectId)) {
      return errorResponse(400, 'A valid procedure projectId is required')
    }
    if (!processAssistantMockStore.getProject(projectId)) {
      return errorResponse(400, 'The parent project does not exist')
    }
    return HttpResponse.json(
      processAssistantMockStore.createProcedure(procedure),
      { status: 201 }
    )
  }),

  http.get(`${api}/Procedure/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid procedure ID')
    const procedure = processAssistantMockStore.getProcedure(id)
    return procedure
      ? HttpResponse.json(procedure)
      : errorResponse(404, 'Procedure not found')
  }),

  http.put(`${api}/Procedure/:id`, async ({ params, request }) => {
    const id = parseId(params.id)
    const procedure = await readDto<ProcedureDto>(request)
    if (
      !isPositiveInteger(id) ||
      !procedure ||
      !isPositiveInteger(procedure.projectId ?? 0)
    ) {
      return errorResponse(400, 'A valid procedure is required')
    }
    if (!processAssistantMockStore.getProject(procedure.projectId!)) {
      return errorResponse(400, 'The parent project does not exist')
    }
    return processAssistantMockStore.updateProcedure(id, procedure)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Procedure not found')
  }),

  http.delete(`${api}/Procedure/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid procedure ID')
    return processAssistantMockStore.deleteProcedure(id)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Procedure not found')
  }),

  http.get(`${api}/Operation`, ({ request }) => {
    const procedureId = parseQueryId(request, 'procedureId')
    return isPositiveInteger(procedureId)
      ? HttpResponse.json(processAssistantMockStore.listOperations(procedureId))
      : errorResponse(400, 'A valid procedureId is required')
  }),

  http.post(`${api}/Operation`, async ({ request }) => {
    const operation = await readDto<OperationDto>(request)
    const procedureId = operation?.procedureId ?? 0
    if (!operation || !isPositiveInteger(procedureId)) {
      return errorResponse(400, 'A valid operation procedureId is required')
    }
    if (!processAssistantMockStore.getProcedure(procedureId)) {
      return errorResponse(400, 'The parent procedure does not exist')
    }
    return HttpResponse.json(
      processAssistantMockStore.createOperation(operation),
      { status: 201 }
    )
  }),

  http.get(`${api}/Operation/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid operation ID')
    const operation = processAssistantMockStore.getOperation(id)
    return operation
      ? HttpResponse.json(operation)
      : errorResponse(404, 'Operation not found')
  }),

  http.put(`${api}/Operation/:id`, async ({ params, request }) => {
    const id = parseId(params.id)
    const operation = await readDto<OperationDto>(request)
    const procedureId = operation?.procedureId ?? 0
    if (!isPositiveInteger(id) || !operation || !isPositiveInteger(procedureId)) {
      return errorResponse(400, 'A valid operation is required')
    }
    if (!processAssistantMockStore.getProcedure(procedureId)) {
      return errorResponse(400, 'The parent procedure does not exist')
    }
    return processAssistantMockStore.updateOperation(id, operation)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Operation not found')
  }),

  http.delete(`${api}/Operation/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid operation ID')
    return processAssistantMockStore.deleteOperation(id)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Operation not found')
  }),

  http.get(`${api}/Phase`, ({ request }) => {
    const operationId = parseQueryId(request, 'operationId')
    return isPositiveInteger(operationId)
      ? HttpResponse.json(processAssistantMockStore.listPhases(operationId))
      : errorResponse(400, 'A valid operationId is required')
  }),

  http.post(`${api}/Phase`, async ({ request }) => {
    const phase = await readDto<PhaseDto>(request)
    const operationId = phase?.operationId ?? 0
    if (!phase || !isPositiveInteger(operationId)) {
      return errorResponse(400, 'A valid phase operationId is required')
    }
    if (!processAssistantMockStore.getOperation(operationId)) {
      return errorResponse(400, 'The parent operation does not exist')
    }
    return HttpResponse.json(processAssistantMockStore.createPhase(phase), {
      status: 201
    })
  }),

  http.get(`${api}/Phase/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid phase ID')
    const phase = processAssistantMockStore.getPhase(id)
    return phase
      ? HttpResponse.json(phase)
      : errorResponse(404, 'Phase not found')
  }),

  http.put(`${api}/Phase/:id`, async ({ params, request }) => {
    const id = parseId(params.id)
    const phase = await readDto<PhaseDto>(request)
    const operationId = phase?.operationId ?? 0
    if (!isPositiveInteger(id) || !phase || !isPositiveInteger(operationId)) {
      return errorResponse(400, 'A valid phase is required')
    }
    if (!processAssistantMockStore.getOperation(operationId)) {
      return errorResponse(400, 'The parent operation does not exist')
    }
    return processAssistantMockStore.updatePhase(id, phase)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Phase not found')
  }),

  http.delete(`${api}/Phase/:id`, ({ params }) => {
    const id = parseId(params.id)
    if (!isPositiveInteger(id)) return errorResponse(400, 'Invalid phase ID')
    return processAssistantMockStore.deletePhase(id)
      ? new HttpResponse(null, { status: 204 })
      : errorResponse(404, 'Phase not found')
  })
]
