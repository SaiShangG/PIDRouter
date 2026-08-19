# 可拆卸的 MSW 模拟后台执行计划

## 目标

为 `cad-simple-viewer-example` 增加一个仅开发模式启用、纯内存且刷新即重置的 Process Assistant 模拟后台。

所有状态、初始数据、HTTP handlers 和浏览器/Node 适配器集中在 `src/mocks/process-assistant/`。现有业务 API、Client 和 Repository 保持不变，页面入口只增加一个可删除的启动调用。

通过专用 `dev:mock` 脚本启用模拟后台。普通 `dev` 仍连接真实后台，生产构建不得启动 mock。

## Project HTTP 实现状态

Project 已从 IndexedDB 数据路径迁移为正式 HTTP 请求链：

```text
ProjectManagementModal
   -> ProcessAssistantProjectRepository
   -> ProcessAssistantProjectApi
   -> ProcessAssistantClient
   -> /api/v1/Project
```

- 普通 `dev` 通过 Vite `/api` proxy 请求真实后台。
- `dev:mock` 发出相同请求，由 MSW 拦截，不在 UI 或 Repository 中添加 mock 分支。
- 页面新增 Project 固定调用 `POST /api/v1/Project/add-v2`；标准 `POST /Project` 仍保留完整契约能力。
- `ProjectDto.jsonData` 使用 `{ "schemaVersion": 1, "description": string, "fileIds": number[] }`。
- active Project ID 保存于 localStorage key `cad-simple-viewer-example-active-project-id`。
- 初始化选择顺序为：有效的已保存 ID、有效的环境变量 ID、Project 列表第一项、无 Project 空状态。
- 切换 Project 时使用其数字 ID 重建 `PhaseWorkspaceRepository`，重新加载对应 Procedure、Operation 和 Phase。
- 旧 `IndexedDbProjectRepository` 已移除；删除 MSW 后，Project 仍继续请求真实后台。

## 阶段一：建立独立接入边界

1. 在 `packages/cad-simple-viewer-example/package.json` 中加入精确版本的 MSW 2.x 开发依赖。
2. 增加 `dev:mock` 脚本，使用 Vite 的 `mock` mode。普通 `dev` 行为保持不变。
3. 新建 `packages/cad-simple-viewer-example/.env.mock`：

   ```dotenv
   VITE_PROCESS_ASSISTANT_MOCK=true
   VITE_PROCESS_ASSISTANT_PROJECT_ID=1
   ```

4. 使用 MSW CLI 生成：

   ```text
   packages/cad-simple-viewer-example/public/mockServiceWorker.js
   ```

5. 新建 `src/mocks/process-assistant/start.ts`：
   - 仅当 `import.meta.env.DEV` 为 true 且 `VITE_PROCESS_ASSISTANT_MOCK === 'true'` 时启动。
   - 动态导入浏览器 worker，避免生产构建加载 mock handlers。
   - 等待 `worker.start()` 完成后再创建应用。
   - 使用 `onUnhandledRequest: 'bypass'`，放行 CAD worker、静态资源和其他请求。
   - 使用 `${import.meta.env.BASE_URL}mockServiceWorker.js` 注册 worker，兼容当前 `base: './'`。
6. 将 `src/main.ts` 底部启动逻辑收拢为异步 `bootstrap()`。
7. 在 `new CadViewerApp()` 之前等待 `startProcessAssistantMock()`。
8. 保持现有 `DOMContentLoaded` 分支和样式注入顺序不变。

## 阶段二：实现纯内存模拟后台

新增目录：

```text
packages/cad-simple-viewer-example/src/mocks/process-assistant/
  browser.ts
  fixtures.ts
  handlers.ts
  start.ts
  store.ts
```

### fixtures.ts

定义可供页面直接浏览的最小初始数据：

- Project
- Procedure
- Operation
- Phase
- 示例文件及其 metadata

数据使用后端契约对应的 `ProjectDto`、`AddProjectDto`、`ProcedureDto`、`OperationDto`、`PhaseDto` 和 `UploadFileDto` 类型。

`jsonData` 应遵守 `phaseWorkspaceRepository` 当前格式。fixtures 只用于初始化，不作为运行期间的可变状态。

### store.ts

实现独立的纯内存数据仓库：

- 从 fixtures 深拷贝初始化。
- 为各资源维护单调递增 ID。
- 提供 Project、Procedure、Operation、Phase 和 File 的查询与 CRUD。
- Project 与其他 Process Assistant 资源统一使用 `int32` 数字 ID。
- 文件采用 metadata 加 Blob 的形式保存。
- 提供 `reset()`，供自动化测试恢复初始状态。
- 不使用 localStorage 或 IndexedDB。
- 刷新页面后自动恢复初始数据。

### handlers.ts

使用 MSW 2.x 的 `http` 和 `HttpResponse` 实现完整接口。

handler 使用 host 无关的 `*/api/v1/...` 路径，同时支持：

- Vite 开发代理 `/api`。
- `VITE_PROCESS_ASSISTANT_USE_PROXY=false` 时的绝对 URL。
- 后续后台地址变化。

#### Project API

Project mock 严格采用已确认的后端 API 契约：

| 方法 | 路径 | 参数/请求体 | 200 响应 |
| --- | --- | --- | --- |
| GET | `/api/v1/Project` | 无 | `ProjectDto[]` |
| POST | `/api/v1/Project` | Body：`ProjectDto` | 新增 ID：`int32` |
| GET | `/api/v1/Project/:id` | Path：`id: int32` | `ProjectDto` |
| PUT | `/api/v1/Project/:id` | Path：`id: int32`；Body：`ProjectDto` | 无响应模型 |
| DELETE | `/api/v1/Project/:id` | Path：`id: int32` | 无响应模型 |
| POST | `/api/v1/Project/add-v2` | Body：`AddProjectDto` | 新增 ID：`int32` |

在 `src/api/processAssistantTypes.ts` 中补充与后端 Swagger/OpenAPI 字段完全一致的 `ProjectDto` 和 `AddProjectDto`。不得复用当前 IndexedDB Project UI 使用的 `ProjectRecord` / `ProjectInput`，除非后续确认两组字段完全一致。

新增 `ProcessAssistantProjectApi`，保持与现有 API 类相同的调用方式：

- `list()` 调用 `GET /api/v1/Project`。
- `create(project)` 调用 `POST /api/v1/Project` 并返回 `number`。
- `get(id)` 调用 `GET /api/v1/Project/{id}`。
- `update(id, project)` 调用 `PUT /api/v1/Project/{id}`。
- `delete(id)` 调用 `DELETE /api/v1/Project/{id}`。
- `addV2(project)` 调用 `POST /api/v1/Project/add-v2` 并返回 `number`。

Project handler 要求：

- `POST /Project` 接收并保存完整 `ProjectDto`，返回新生成的数字 ID。
- `POST /Project/add-v2` 接收 `AddProjectDto`，按后端 DTO 映射规则生成并保存 `ProjectDto`，返回新生成的数字 ID。
- Project ID 使用单调递增的正 `int32`，fixtures 中的最大 ID 决定下一个 ID。
- `PUT` 成功后返回无响应模型，建议使用 204；`DELETE` 同理。
- 缺失 Project 返回 404 JSON。
- 非正整数、超出 `int32` 范围的 ID、错误请求体返回 400 JSON。
- 除 Swagger/OpenAPI 声明的校验外，handler 不自行添加名称唯一性、drawing 数量或时间字段规则。
- 删除 Project 不级联删除 File、Procedure、Operation 或 Phase。

ID 边界：

- Project 新增接口返回的 ID 和 `ProcedureDto.projectId` 均为数字。
- Procedure fixtures 的 `projectId` 必须指向一个存在的 Project fixture。
- 创建或更新 Procedure 时，若 `projectId` 不存在，返回 400 JSON。
- `.env.mock` 中的 `VITE_PROCESS_ASSISTANT_PROJECT_ID=1` 必须对应初始 Project fixture 的 ID。

#### File API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/File` | 返回文件列表 |
| GET | `/api/v1/File/:id` | 返回文件详情 |
| POST | `/api/v1/File/upload` | 解析 `file` 和可选 `comment` multipart 字段 |
| POST | `/api/v1/File/upload-multiple` | 解析多个 `files` multipart 字段 |
| GET | `/api/v1/File/download/:storedFileName` | 返回对应 Blob |
| PUT | `/api/v1/File/:id/comment` | 接收 JSON 字符串 comment |
| DELETE | `/api/v1/File/:storedFileName` | 按存储文件名删除 |

#### Procedure API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/Procedure?projectId=:id` | 按 projectId 返回列表 |
| POST | `/api/v1/Procedure` | 创建并返回数字 ID |
| GET | `/api/v1/Procedure/:id` | 返回详情 |
| PUT | `/api/v1/Procedure/:id` | 更新并返回 204 |
| DELETE | `/api/v1/Procedure/:id` | 删除并返回 204 |

#### Operation API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/Operation?procedureId=:id` | 按 procedureId 返回列表 |
| POST | `/api/v1/Operation` | 创建并返回数字 ID |
| GET | `/api/v1/Operation/:id` | 返回详情 |
| PUT | `/api/v1/Operation/:id` | 更新并返回 204 |
| DELETE | `/api/v1/Operation/:id` | 删除并返回 204 |

#### Phase API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/Phase?operationId=:id` | 按 operationId 返回列表 |
| POST | `/api/v1/Phase` | 创建并返回数字 ID |
| GET | `/api/v1/Phase/:id` | 返回详情 |
| PUT | `/api/v1/Phase/:id` | 更新并返回 204 |
| DELETE | `/api/v1/Phase/:id` | 删除并返回 204 |

接口行为要求：

- 缺失资源返回 404 JSON。
- 无效 multipart、缺失父 ID 或错误请求体返回 400 JSON。
- 成功更新和删除返回 204。
- 保留前端传入的 `index`、`orderIndex` 和 `jsonData`。
- 不解析或改写业务 `jsonData`。
- 下载路径正确处理 URL 编码后的 `storedFileName`。

### browser.ts

只负责使用共享 handlers 创建 `setupWorker`，不包含业务数据和 endpoint 逻辑。

## 阶段三：自动化验证

新增：

```text
packages/cad-simple-viewer-example/__tests__/processAssistantMock.spec.ts
```

使用 `msw/node` 的 `setupServer` 复用浏览器 handlers，并通过现有 `ProcessAssistantClient` 以及 Project、File、Procedure、Operation、Phase API 类发起请求。

测试生命周期：

- 每个测试前调用 store `reset()`。
- 每个测试后调用 `server.resetHandlers()`。
- 测试套件结束后关闭 server。

测试覆盖：

1. 加载初始 Project、Procedure、Operation 和 Phase 数据。
2. 通过 `POST /Project` 创建 Project，并验证返回 `int32` ID。
3. 通过 `POST /Project/add-v2` 创建 Project，并验证 `AddProjectDto` 映射及返回 `int32` ID。
4. 查询、更新和删除 Project，并验证无响应模型。
5. 创建、查询、更新和删除 Procedure。
6. 验证 Procedure 的 `projectId` 必须指向已存在的 Project。
7. 在 Procedure 下创建 Operation。
8. 在 Operation 下创建 Phase。
9. 验证 query 参数的父级过滤。
10. 验证 Phase `jsonData` 完整往返。
11. 上传单个文件并验证 comment。
12. 上传多个文件。
13. 下载文件并核对 Blob 内容。
14. 更新文件 comment。
15. 删除文件。
16. 验证 400 和 404 被客户端转换成类型化错误。

执行命令：

```powershell
pnpm jest packages/cad-simple-viewer-example/__tests__/processAssistantMock.spec.ts --runInBand

pnpm jest packages/cad-simple-viewer-example/__tests__/processAssistantApi.spec.ts packages/cad-simple-viewer-example/__tests__/phaseWorkspaceRepository.spec.ts packages/cad-simple-viewer-example/__tests__/ProcessAssistantDrawingRepository.spec.ts --runInBand

pnpm --filter @mlightcad/cad-simple-viewer-example build
pnpm --filter @mlightcad/cad-simple-viewer-example lint
```

## 阶段四：页面操作验证

启动模拟后台：

```powershell
pnpm --filter @mlightcad/cad-simple-viewer-example dev:mock
```

手工验证：

1. 页面可以加载初始 Project、层级和文件列表。
2. Project 可以通过标准新增接口和 `add-v2` 新增，并可查询、编辑和删除。
3. Project 和 Procedure 使用一致的数字 `projectId` 关联。
4. Procedure、Operation 和 Phase 可以新增、编辑和删除。
5. Phase 状态及 `jsonData` 可以保存并重新读取。
6. 单文件和多文件上传正常。
7. 文件下载内容正确。
8. 刷新页面后恢复 fixtures。
9. 浏览器 Application 面板中可看到 `mockServiceWorker.js` 注册成功。
10. Network 面板中的 Project 和 Process Assistant API 显示 mocked response。
11. CAD worker、字体和静态资源没有被 MSW 拦截。

再使用普通开发模式验证 mock 未启用：

```powershell
pnpm --filter @mlightcad/cad-simple-viewer-example dev
```

## 后续删除清单

需要移除 mock 时执行以下操作：

1. 删除整个目录：

   ```text
   packages/cad-simple-viewer-example/src/mocks/process-assistant/
   ```

2. 删除以下文件：

   ```text
   packages/cad-simple-viewer-example/public/mockServiceWorker.js
   packages/cad-simple-viewer-example/.env.mock
   packages/cad-simple-viewer-example/__tests__/processAssistantMock.spec.ts
   ```

3. 从 `src/main.ts` 删除：
   - `startProcessAssistantMock` import。
   - `bootstrap()` 中对应的 await 调用。
   - 如无其他异步启动需求，可恢复原来的同步入口。
4. 从示例包 `package.json` 删除：
   - `dev:mock` 脚本。
   - `msw` 开发依赖。
   - MSW CLI 可能写入的 `msw.workerDirectory` 元数据。
5. 重新安装依赖以更新锁文件：

   ```powershell
   pnpm install
   ```

6. 清理并重新构建，避免旧 worker 留在生成目录中。
7. 删除 README 中的 Mock backend 开发说明。

## 约束与非目标

- 不修改现有 Process Assistant API、Client 或 Repository。
- 不修改 `vite.config.ts`；Vite 自动复制 `public/mockServiceWorker.js`。
- 不增加页面内 mock 开关。
- 不增加持久化数据库。
- 不模拟鉴权。
- Project API 按已确认的后端契约实现；`ProjectDto` 和 `AddProjectDto` 的具体字段必须以 Swagger/OpenAPI 为准。
- 不增加真实后台契约之外的接口。
- 不让 mock 在生产环境启用。
- 不将模拟数据写入产品代码或用户数据仓库。
