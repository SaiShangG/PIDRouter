# 实际后台 API 前端接入 TODO

## 1. 目标

在 `cad-simple-viewer-example` 中接入实际 ProcessAssistant 后台，用于测试以下 API：

- File：上传、查询、下载、更新备注和删除图纸文件。
- Procedure：映射为前端 Process。
- Operation：映射为前端 Sequence。
- Phase：映射为前端 Phase。

后台地址：

```text
http://192.168.1.100:5153
```

OpenAPI 地址：

```text
http://192.168.1.100:5153/swagger/v1/swagger.json
```

## 2. 实际数据映射

| 前端模型 | 后台模型 | 父级字段 |
| --- | --- | --- |
| Process | `ProcedureDto` | `projectId` |
| Sequence | `OperationDto` | `procedureId` |
| Phase | `PhaseDto` | `operationId` |
| Drawing | `UploadFileDto` | 后台暂未提供 Phase 文件关联字段 |

约束：

- 当前启用 API 调试模式，Process、Sequence、Phase 和 File 只从目标服务器读取，不加载或回退到本地测试数据。
- 后台 ID 为 `number(int32)`，现有前端 ID 为 `string`，API 边界需要显式转换。
- 创建 Procedure 必须提供 `projectId`，第一阶段通过环境变量指定测试 Project ID。
- Phase 状态、图纸关联及前端扩展字段暂存到 `PhaseDto.jsonData`。
- 后台暂未提供乐观锁、统一错误模型和 Phase Workspace API。
- 删除 Procedure 和 Operation 会触发后台级联删除，前端必须二次确认。

## 3. API 基础设施

- [x] 新建 `src/api/processAssistantTypes.ts`。
- [x] 定义 `UploadFileDto`、`ProcedureDto`、`OperationDto` 和 `PhaseDto`。
- [x] 定义统一的前端 API 错误类型。
- [x] 新建 `src/api/processAssistantClient.ts`。
- [x] 支持可配置的 `baseUrl`。
- [x] 实现 JSON 请求、响应和空响应解析。
- [x] 实现 `multipart/form-data` 文件上传。
- [x] 实现文件 `Blob` 下载。
- [x] 支持 `AbortSignal` 请求取消。
- [x] 将非 2xx 响应转换为统一前端错误。
- [x] 新增 `VITE_PROCESS_ASSISTANT_API_URL`。
- [x] 新增 `VITE_PROCESS_ASSISTANT_PROJECT_ID`。
- [x] 配置 Vite `/api` 开发代理，避免浏览器 CORS 问题。

## 4. File API

- [x] 实现 `GET /api/v1/File`。
- [x] 实现 `GET /api/v1/File/{id}`。
- [x] 实现 `POST /api/v1/File/upload`。
- [x] 实现 `POST /api/v1/File/upload-multiple`。
- [x] 实现 `GET /api/v1/File/download/{storedFileName}`。
- [x] 实现 `PUT /api/v1/File/{id}/comment`。
- [x] 实现 `DELETE /api/v1/File/{storedFileName}`。
- [x] 文件列表显示名称、大小、上传时间和备注。
- [x] 上传成功后刷新文件列表。
- [x] 使用 `url` 或下载接口加载远程 DWG。
- [ ] 删除前检查当前 Phase 是否正在引用该文件。
- [ ] 显示上传进度、失败原因和重试操作。

## 5. Procedure / Process API

- [x] 实现 `GET /api/v1/Procedure?projectId={projectId}`。
- [x] 实现 `POST /api/v1/Procedure`。
- [x] 实现 `GET /api/v1/Procedure/{id}`。
- [x] 实现 `PUT /api/v1/Procedure/{id}`。
- [x] 实现 `DELETE /api/v1/Procedure/{id}`。
- [x] 将 `ProcedureDto.id` 转换为前端字符串 ID。
- [x] 创建 Process 时写入配置的 `projectId`。
- [x] 将 Process 展示配置序列化到 `jsonData`。
- [x] 删除前提示后台将级联删除 Sequence 和 Phase。
- [x] 仅在 API 成功后更新前端内存状态。

## 6. Operation / Sequence API

- [x] 实现 `GET /api/v1/Operation?procedureId={procedureId}`。
- [x] 实现 `POST /api/v1/Operation`。
- [x] 实现 `GET /api/v1/Operation/{id}`。
- [x] 实现 `PUT /api/v1/Operation/{id}`。
- [x] 实现 `DELETE /api/v1/Operation/{id}`。
- [x] 将 `procedureId` 映射为所属 Process ID。
- [x] 将 `index` 映射为业务编号 `number`。
- [x] 将 `orderIndex` 映射为显示顺序。
- [x] 将 Sequence 扩展数据序列化到 `jsonData`。
- [x] 前端排序后逐项更新 `orderIndex`。
- [x] 删除前提示后台将级联删除 Phase。

## 7. Phase API

- [x] 实现 `GET /api/v1/Phase?operationId={operationId}`。
- [x] 实现 `POST /api/v1/Phase`。
- [x] 实现 `GET /api/v1/Phase/{id}`。
- [x] 实现 `PUT /api/v1/Phase/{id}`。
- [x] 实现 `DELETE /api/v1/Phase/{id}`。
- [x] 将 `operationId` 映射为所属 Sequence ID。
- [x] 将 `index` 映射为业务编号 `number`。
- [x] 将 `orderIndex` 映射为显示顺序。
- [x] 在 `jsonData` 中保存 Phase 状态和图纸引用。
- [x] 激活 Phase 时读取关联文件并加载 Viewer。
- [x] 修改高亮或设备状态后保存 `jsonData`。
- [x] Phase 复制通过读取源 Phase 后创建新 DTO 实现。
- [x] 图纸关联更新后调用 Phase PUT。
- [x] 删除当前 Phase 后自动选择相邻 Phase。

建议的 `jsonData` 结构：

```json
{
  "schemaVersion": 1,
  "drawing": {
    "fileId": 12,
    "storedFileName": "uuid-file.dwg",
    "displayName": "PID-1001.dwg"
  },
  "sourcePhaseId": 24,
  "flowState": {
    "flowPaths": []
  },
  "deviceStates": {}
}
```

## 8. Repository 与状态迁移

- [x] 新建 `src/phase/phaseWorkspaceRepository.ts`。
- [x] Repository 组合 File、Procedure、Operation 和 Phase API。
- [x] 将后台扁平 DTO 组装为 `PhaseWorkspaceState`。
- [x] 保留 `PhaseWorkspaceStore` 作为前端内存状态容器。
- [x] 将工作区初始化改为异步加载后台数据。
- [x] 将面板 CRUD action 改为异步调用 Repository。
- [ ] 请求期间禁用重复提交。
- [x] 请求失败时不修改内存状态。
- [x] API 调试模式不读取 localStorage 工作区缓存。
- [x] 后台加载成功后以后台数据为准。
- [x] 不自动上传 IndexedDB 中已有的本地图纸。

## 9. UI 接入

- [ ] 增加工作区全局加载状态。
- [x] 增加 API 不可用和离线提示。
- [x] CRUD 操作显示成功或失败 Toast。
- [x] File 面板增加后台文件来源。
- [x] 创建或编辑 Phase 时允许选择后台 DWG。
- [ ] 明确区分本地图纸和后台图纸。
- [x] 删除操作显示级联影响警告。
- [ ] 防止重复点击产生重复后台记录。

## 10. 测试

- [x] 测试 Client 的 URL、HTTP 方法、Query 和 Body。
- [ ] 测试 multipart 单文件和多文件上传。
- [x] 测试文件 Blob 下载。
- [ ] 测试非 2xx、网络失败和空响应体。
- [x] 测试 `jsonData` 正常、空值及损坏数据降级。
- [x] 测试 Repository 的 Process/Sequence/Phase 层级组装。
- [x] 测试数字 ID 与字符串 ID 转换。
- [ ] 测试 UI 加载、空状态和错误状态。
- [ ] 测试创建、修改和删除 Process、Sequence、Phase。
- [ ] 测试上传文件并关联 Phase。
- [ ] 测试删除级联确认。
- [x] 运行 `pnpm --filter @mlightcad/cad-simple-viewer-example lint`。
- [x] 运行 `pnpm --filter @mlightcad/cad-simple-viewer-example build`。
- [x] 运行相关 Jest 测试。

## 11. 执行顺序

- [x] 第一阶段：API 类型、基础 Client 和环境配置。
- [x] 第二阶段：File API 和后台图纸列表。
- [x] 第三阶段：Procedure/Process CRUD。
- [x] 第四阶段：Operation/Sequence CRUD。
- [x] 第五阶段：Phase CRUD 与 `jsonData`。
- [x] 第六阶段：Repository 接入现有面板。
- [x] 第七阶段：Viewer 加载后台 DWG。
- [ ] 第八阶段：自动化测试和实际后台联调。

## 12. 联调验收

- [ ] 能从后台加载 Process → Sequence → Phase 层级。
- [ ] 能创建、修改和删除三层业务对象。
- [ ] 能上传 DWG 并在文件列表中看到记录。
- [ ] 能将后台文件关联到 Phase。
- [ ] 刷新页面后能恢复后台数据和 Phase 状态。
- [ ] 切换 Phase 能加载对应图纸和展示状态。
- [ ] API 请求失败不会破坏当前前端状态。
- [ ] 浏览器控制台无未处理 Promise rejection。
