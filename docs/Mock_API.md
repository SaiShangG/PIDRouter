# 可拆卸的 MSW 模拟后台执行计划

## 目标

为 `cad-simple-viewer-example` 增加一个仅开发模式启用、纯内存且刷新即重置的 Process Assistant 模拟后台。

所有状态、初始数据、HTTP handlers 和浏览器/Node 适配器集中在 `src/mocks/process-assistant/`。现有业务 API、Client 和 Repository 保持不变，页面入口只增加一个可删除的启动调用。

通过专用 `dev:mock` 脚本启用模拟后台。普通 `dev` 仍连接真实后台，生产构建不得启动 mock。

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

- Procedure
- Operation
- Phase
- 示例文件及其 metadata

数据使用现有 `ProcedureDto`、`OperationDto`、`PhaseDto` 和 `UploadFileDto` 类型。

`jsonData` 应遵守 `phaseWorkspaceRepository` 当前格式。fixtures 只用于初始化，不作为运行期间的可变状态。

### store.ts

实现独立的纯内存数据仓库：

- 从 fixtures 深拷贝初始化。
- 为各资源维护单调递增 ID。
- 提供 Procedure、Operation、Phase 和 File 的查询与 CRUD。
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

使用 `msw/node` 的 `setupServer` 复用浏览器 handlers，并通过现有 `ProcessAssistantClient` 和四个 API 类发起请求。

测试生命周期：

- 每个测试前调用 store `reset()`。
- 每个测试后调用 `server.resetHandlers()`。
- 测试套件结束后关闭 server。

测试覆盖：

1. 加载初始 Procedure、Operation 和 Phase 层级。
2. 创建、查询、更新和删除 Procedure。
3. 在 Procedure 下创建 Operation。
4. 在 Operation 下创建 Phase。
5. 验证 query 参数的父级过滤。
6. 验证 Phase `jsonData` 完整往返。
7. 上传单个文件并验证 comment。
8. 上传多个文件。
9. 下载文件并核对 Blob 内容。
10. 更新文件 comment。
11. 删除文件。
12. 验证 400 和 404 被转换成 `ProcessAssistantApiError`。

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

1. 页面可以加载初始层级和文件列表。
2. Procedure、Operation 和 Phase 可以新增、编辑和删除。
3. Phase 状态及 `jsonData` 可以保存并重新读取。
4. 单文件和多文件上传正常。
5. 文件下载内容正确。
6. 刷新页面后恢复 fixtures。
7. 浏览器 Application 面板中可看到 `mockServiceWorker.js` 注册成功。
8. Network 面板中的 Process Assistant API 显示 mocked response。
9. CAD worker、字体和静态资源没有被 MSW 拦截。

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
- 不增加真实后台契约之外的接口。
- 不让 mock 在生产环境启用。
- 不将模拟数据写入产品代码或用户数据仓库。
