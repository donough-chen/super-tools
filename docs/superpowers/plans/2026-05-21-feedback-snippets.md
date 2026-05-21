# Feedback Reply Snippets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build complete feedback reply snippet management: CRUD + categories + tags + version history + smart recommendation + variable substitution + usage stats + import/export + role-level access + reply UI integration.

**Architecture:** Egg.js + Sequelize backend with 5 new tables (categories tree / snippets / versions / usage logs / role permissions). React + Antd admin pages mirror existing `Notification/Templates` patterns. SnippetPicker component integrates into existing `DetailDrawer.tsx`. Reuses `app/lib/templateRenderer.ts` for variable substitution.

**Tech Stack:** Egg.js, Sequelize, MySQL 8, React 18, Ant Design 5, UmiJS 4, less, @ant-design/charts.

---

## File Structure

### Backend (super-tool-node)

| File | Responsibility |
|---|---|
| `database/020_add_feedback_snippets.sql` | Schema + RBAC + role mappings + system seed |
| `app/model/feedback_snippet_category.ts` | Category tree model |
| `app/model/feedback_snippet.ts` | Snippet model |
| `app/model/feedback_snippet_version.ts` | Version snapshot model |
| `app/model/feedback_snippet_usage_log.ts` | Usage log model |
| `app/service/feedback/snippet_category.ts` | Category service |
| `app/service/feedback/snippet.ts` | Snippet service (CRUD + publish + recommend + render + stats + import/export) |
| `app/controller/admin/feedback/snippet_category.ts` | Category controller |
| `app/controller/admin/feedback/snippet.ts` | Snippet controller |
| `app/service/feedback.ts` | **Modify**: reply() supports snippetId; update() syncs feedback_status_after |
| `app/router.ts` | **Modify**: register ~18 new routes |

### Frontend Admin (super-tools-admin)

| File | Responsibility |
|---|---|
| `src/services/feedbackSnippet.ts` | API client |
| `config/routes/modules/feedback.ts` | **Modify**: add 2 sub-routes |
| `src/pages/Feedback/Snippets/index.tsx` + `.less` | Main management page |
| `src/pages/Feedback/Snippets/CategoryTree.tsx` | Category tree component |
| `src/pages/Feedback/Snippets/SnippetEditDrawer.tsx` | Snippet edit drawer |
| `src/pages/Feedback/Snippets/VersionHistoryDrawer.tsx` | Version timeline drawer |
| `src/pages/Feedback/Snippets/CategoryRolePermDrawer.tsx` | Role permission drawer |
| `src/pages/Feedback/Snippets/Stats/index.tsx` + `.less` | Stats page |
| `src/components/SnippetPicker/index.tsx` + `.less` | Picker component |
| `src/pages/Feedback/List/DetailDrawer.tsx` | **Modify**: integrate SnippetPicker |
| `src/services/feedback.ts` | **Modify**: replyFeedback supports snippetId |
| `src/utils/snippetVars.ts` | Variable extraction helpers |

---

## Task List Overview

| # | Task | Effort |
|---|---|---|
| 1 | DB Migration (020) | 5 min |
| 2 | 4 Sequelize Models | 5 min |
| 3 | Category Service | 5 min |
| 4 | Snippet Service - CRUD + Publish/Rollback | 8 min |
| 5 | Snippet Service - Render/Recommend/Usage/Stats/Import-Export | 12 min |
| 6 | Controllers (category + snippet) | 8 min |
| 7 | feedback.ts service hook integration + Router | 5 min |
| 8 | Admin Frontend - Service + Routes Config | 3 min |
| 9 | Admin Frontend - Snippets Main Page | 12 min |
| 10 | Admin Frontend - Stats Page | 5 min |
| 11 | Admin Frontend - SnippetPicker + DetailDrawer Integration | 8 min |

**Total estimate: ~76 min**

---

## Task 1: Database Migration

**Files:**
- Create: `super-tool-node/database/020_add_feedback_snippets.sql`

- [ ] **Step 1: Write migration script**

Create `super-tool-node/database/020_add_feedback_snippets.sql` with:
- 5 tables: `feedback_snippet_categories` (paranoid tree), `feedback_snippets` (paranoid), `feedback_snippet_versions`, `feedback_snippet_usage_logs`, `feedback_snippet_role_permissions`
- Idempotent permission cleanup (DELETE existing `feedback:snippet%` codes + role mappings)
- 22 new permissions: 1 dir + 2 menus + 5 buttons + 14 APIs (refer spec §7.1)
- Role mappings: admin=22, operator=20 (no publish/import-export), auditor=7 (read-only)
- Seed 4 system categories: `sys-bug` / `sys-suggestion` / `sys-praise` / `sys-general` (is_system=1)
- Seed 6 system snippets (each category 1-2 sample templates, created_by=0)

> **Reference**: Follow exact pattern of `database/019_feedback_enhancement.sql` (header comment style, idempotent DELETE+INSERT, role mapping CROSS JOIN).
> **Schema details**: All fields per spec §3 (3.1-3.5). All tables ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci. Use `UNIQUE KEY uk_code (code, deleted_at)` for paranoid tables.
> **Permissions detail**: Each permission row: code/name/type/module='feedback'/platform='admin'/path/method/parent_id/sort. Refer to spec §7.1 for the hierarchy.

- [ ] **Step 2: Verify file**

```bash
cd d:\Donough\Projects\super-tools\super-tool-node
Test-Path database\020_add_feedback_snippets.sql
```
Expected: `True`

- [ ] **Step 3: Commit**

```bash
cd d:\Donough\Projects\super-tools
git add super-tool-node/database/020_add_feedback_snippets.sql
git commit -m "feat(feedback-snippet): add migration 020 - schema + RBAC + seed"
```

---
## Task 2: Sequelize Models

**Files:**
- Create: `super-tool-node/app/model/feedback_snippet_category.ts`
- Create: `super-tool-node/app/model/feedback_snippet.ts`
- Create: `super-tool-node/app/model/feedback_snippet_version.ts`
- Create: `super-tool-node/app/model/feedback_snippet_usage_log.ts`

- [ ] **Step 1: Create category model**

`feedback_snippet_category.ts` (mirror `notification_type.ts` pattern):
- Table `feedback_snippet_categories`, paranoid:true, underscored:true, timestamps:true
- Fields per spec §3.1: id, parentId(field='parent_id'), code, name, description, feedbackType(field='feedback_type'), icon, color, sortOrder(field='sort_order'), status, isSystem(field='is_system'), deletedAt
- Associate: hasMany FeedbackSnippet { foreignKey:'category_id', as:'snippets' }

- [ ] **Step 2: Create snippet model**

`feedback_snippet.ts`:
- Table `feedback_snippets`, paranoid:true, underscored:true, timestamps:true
- Fields per spec §3.2: id, categoryId(field='category_id'), code, title, content (TEXT), tags, sampleVariables(JSON, field='sample_variables'), currentVersion (field='current_version'), status, usageCount(field='usage_count'), lastUsedAt(field='last_used_at'), description, createdBy(field='created_by'), updatedBy(field='updated_by'), deletedAt
- Associations:
  - belongsTo FeedbackSnippetCategory { foreignKey:'category_id', as:'category' }
  - hasMany FeedbackSnippetVersion { foreignKey:'snippet_id', as:'versions' }
  - belongsTo User { foreignKey:'created_by', as:'creator' }

- [ ] **Step 3: Create version snapshot model**

`feedback_snippet_version.ts`:
- Table `feedback_snippet_versions`, timestamps:false (only published_at), underscored:true
- Fields per spec §3.3: id, snippetId(field='snippet_id'), version, title, content, tags, sampleVariables(JSON), changeNote(field='change_note'), publishedBy(field='published_by'), publishedAt(field='published_at')
- Associations:
  - belongsTo FeedbackSnippet { foreignKey:'snippet_id', as:'snippet' }
  - belongsTo User { foreignKey:'published_by', as:'publisher' }

- [ ] **Step 4: Create usage log model**

`feedback_snippet_usage_log.ts`:
- Table `feedback_snippet_usage_logs`, timestamps:false, underscored:true
- Fields per spec §3.4: id, snippetId, feedbackId, userId, finalContent, feedbackStatusAfter(field='feedback_status_after'), createdAt
- Associations: belongsTo FeedbackSnippet { foreignKey:'snippet_id', as:'snippet' }

- [ ] **Step 5: Verify lint**

Use read_lints on all 4 created model files. Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add super-tool-node/app/model/feedback_snippet*.ts
git commit -m "feat(feedback-snippet): add 4 sequelize models"
```

---

## Task 3: Category Service

**Files:**
- Create: `super-tool-node/app/service/feedback/snippet_category.ts`

- [ ] **Step 1: Implement service class**

Class `FeedbackSnippetCategoryService extends Service`. Methods:

**`list()`**:
- Return `findAll({ order: [['sortOrder','ASC'],['id','ASC']] })`
- Frontend assembles tree

**`detail(id)`**:
- `findByPk(id)`; throw 404 if not found

**`create(payload)`**:
- Code uniqueness check (with paranoid:true to include soft-deleted): if exists → throw 409
- Create with isSystem:0 (manual creation defaults to non-system)
- Required fields: code, name; optional: parentId, description, feedbackType, icon, color, sortOrder (default 0), status (default 1)

**`update(id, payload)`**:
- findByPk; throw 404 if not found
- If isSystem=1 AND payload.code differs from existing code → throw 400 ("系统预置分类不可修改 code")
- update + reload

**`destroy(id)`**:
- findByPk; throw 404 if not found
- If isSystem=1 → throw 400 ("系统预置分类不可删除")
- Count `FeedbackSnippet.count({ where: { categoryId: id }})` — if > 0 → throw 422 with count message
- await cat.destroy()  (paranoid soft delete)

**`setRolePermissions(categoryId, roleIds: number[])`**:
- findByPk; throw 404 if not found
- Use raw SQL because table has no PK alone:
  - `DELETE FROM feedback_snippet_role_permissions WHERE category_id = ?`
  - If roleIds.length > 0: bulk INSERT
- Return `{ count: roleIds.length }`

**`getRolePermissions(categoryId): Promise<number[]>`**:
- Raw SQL `SELECT role_id FROM feedback_snippet_role_permissions WHERE category_id = ?`
- Return array of role IDs

**`getAccessibleCategoryIds(userRoleIds: number[]): Promise<number[]>`**:
- Raw SQL: SELECT id FROM feedback_snippet_categories WHERE deleted_at IS NULL AND status=1 AND (id NOT IN (SELECT category_id FROM feedback_snippet_role_permissions) OR id IN (SELECT category_id FROM feedback_snippet_role_permissions WHERE role_id IN (?)))
- Return array of accessible category IDs

> **Note**: Use `(this.app as any).model.query(...)` pattern (consistent with project's `service/notification/audience.ts` raw SQL usage). Always pass replacements + type:'SELECT'.

- [ ] **Step 2: Verify lint**

`read_lints` on the file. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add super-tool-node/app/service/feedback/snippet_category.ts
git commit -m "feat(feedback-snippet): add category service"
```

---
## Task 4: Snippet Service - CRUD + Publish/Rollback

**Files:**
- Create: `super-tool-node/app/service/feedback/snippet.ts`

- [ ] **Step 1: Set up imports and constants**

```typescript
import { Service } from 'egg';
import { Op } from 'sequelize';
import { renderTemplate } from '../../lib/templateRenderer';

const STATUS_DRAFT = 0;
const STATUS_PUBLISHED = 1;
const STATUS_DISABLED = 2;
```

Define interfaces:
- `SnippetCreatePayload`: categoryId, code, title, content, tags?, sampleVariables?, description?
- `SnippetUpdatePayload`: Partial<Omit<SnippetCreatePayload, 'code'>>
- `SnippetListQuery`: page?, pageSize?, categoryId?, status?, keyword?, tag?, sortBy?: 'updated' | 'usage'

- [ ] **Step 2: Implement list/detail**

**`list(q: SnippetListQuery)`**:
- where filters: categoryId, status, keyword (Op.or on title+content+tags LIKE), tag (LIKE)
- pagination: page (default 1, min 1), pageSize (default 20, min 1, max 100)
- order: sortBy='usage' → [['usageCount','DESC'],['id','DESC']]; default → [['updatedAt','DESC'],['id','DESC']]
- include: { association:'category', attributes:['id','name','code'] }
- Return `{ total, page, pageSize, rows }`

**`detail(id)`**:
- findByPk with include category + creator
- throw 404 if not found

- [ ] **Step 3: Implement create/update/destroy**

**`create(payload, operatorId)`**:
- Code uniqueness check (paranoid:true) — throw 409 if exists
- Create with: status=STATUS_DRAFT, currentVersion=1, usageCount=0, createdBy/updatedBy=operatorId
- Other fields from payload (null-coalesce defaults)

**`update(id, payload, operatorId)`**:
- findByPk; throw 404
- **Important**: if status === STATUS_PUBLISHED → throw 400 "已发布话术不可直接编辑，请使用回滚或新建版本"
- Update with payload + updatedBy=operatorId
- Return reload()

**`destroy(id)`**:
- findByPk; throw 404
- await s.destroy() (soft delete)

- [ ] **Step 4: Implement publish/disable**

**`publish(id, operatorId, changeNote?)`**:
- findByPk; throw 404
- If status !== STATUS_DRAFT → throw 400 "仅草稿状态可发布"
- Use `ctx.model.transaction(async t => {...})`:
  - update s: { status: STATUS_PUBLISHED, updatedBy: operatorId } (transaction:t)
  - Check existing version snapshot for (snippetId, currentVersion); if not exists, create one with all current fields + changeNote + publishedBy=operatorId
- Return reload()

**`disable(id, operatorId)`**:
- findByPk; throw 404
- If status !== STATUS_PUBLISHED → throw 400 "仅已发布话术可停用"
- update { status: STATUS_DISABLED, updatedBy: operatorId }
- Return reload()

- [ ] **Step 5: Implement version listing/rollback**

**`listVersions(snippetId)`**:
- `findAll({ where:{snippetId}, include:[{association:'publisher', attributes:['id','username','nickname']}], order:[['version','DESC']] })`

**`rollback(snippetId, versionId, operatorId)`** (mirror `notification/template.ts:rollbackToVersion`):
- findByPk snippet; throw 404
- findByPk version; throw 404
- If version.snippetId !== snippetId → throw 400 "版本不属于该话术"
- Transaction:
  1. Backup current state: create FeedbackSnippetVersion with current snippet's title/content/tags/sampleVariables, version=currentVersion, changeNote=`回滚前备份 (v${currentVersion})`, publishedBy=operatorId
  2. Compute newVersion = currentVersion + 1
  3. Update snippet: title/content/tags/sampleVariables ← from target version, currentVersion=newVersion, status=STATUS_PUBLISHED, updatedBy=operatorId
  4. Create new version snapshot with newVersion, changeNote=`回滚至 v${target.version}`, publishedBy=operatorId
- Return reload()

- [ ] **Step 6: Verify lint**

`read_lints` on the file. Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add super-tool-node/app/service/feedback/snippet.ts
git commit -m "feat(feedback-snippet): add snippet service - CRUD + publish + rollback"
```

---
## Task 5: Snippet Service - Render / Recommend / Usage / Stats / Import-Export

**Files:**
- Modify: `super-tool-node/app/service/feedback/snippet.ts` (append methods to existing class)

- [ ] **Step 1: Add private helper `_buildBuiltInVars(feedbackId?)`**

Returns `Record<string, any>` with:
- `userName`: feedback.user?.nickname || feedback.user?.username || '用户'
- `feedbackId`: fb.id
- `feedbackType`: map bug→'Bug', suggestion→'建议', praise→'表扬', other→'其他'
- `adminName`: ctx.state.user.nickname || ctx.state.user.username
- `currentDate`: new Date().toISOString().slice(0, 10)

If feedbackId provided, fetch feedback with include user. If not provided, only adminName + currentDate set.

- [ ] **Step 2: Add `_extractKeywords(content: string)` helper**

```typescript
const STOP_WORDS = new Set(['的','了','是','我','你','他','她','它','这','那','一','有','不','就','也','都','会','在','和','与','或','但','而','如','及','the','a','an','is','are','and','or']);

private _extractKeywords(content: string): string[] {
  if (!content) return [];
  // Split on punctuation/whitespace
  const segments = content
    .replace(/[\u3000-\u303f\uff00-\uffef]/g, ' ')  // CJK punctuation
    .replace(/[.,;!?\n\r\t,。；！？]/g, ' ')
    .split(/\s+/)
    .filter(s => s.length >= 2 && !STOP_WORDS.has(s));
  return Array.from(new Set(segments)).slice(0, 10);
}
```

- [ ] **Step 3: Add `_getUserRoleIds(userId: number)` helper**

Raw SQL query:
```sql
SELECT role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL
```
Return number[].

- [ ] **Step 4: Add `render(id, customVars, feedbackId?)` method**

- findByPk; throw 404
- builtIn = await this._buildBuiltInVars(feedbackId)
- allVars = { ...builtIn, ...customVars }
- result = renderTemplate(snippet.content, allVars, { escape: 'none' })  ← **escape: 'none'** because reply is plain text (not HTML)
- Return `{ title, content: result.result, missingVars: result.missingVars, sampleVariables }`

- [ ] **Step 5: Add `recommend(feedbackId, userId, limit=5)` method**

Algorithm per spec §5:
1. Validate feedback exists
2. Fetch user's role IDs via `_getUserRoleIds`
3. Get accessible category IDs via `ctx.service.feedback.snippetCategory.getAccessibleCategoryIds(roleIds)`. If empty → return []
4. Fetch candidates: status=PUBLISHED + categoryId IN (accessible) + include category for feedbackType. Use `raw:true, nest:true`
5. Extract reply keywords from feedback.content via `_extractKeywords`
6. maxUsage = max(1, ...candidates.usageCount)
7. User preference: query usage_logs WHERE userId=? AND createdAt >= 30 days ago → set of snippetIds
8. For each candidate, compute score:
   - matchType = (category.feedbackType === feedback.type) ? 0.4 : 0
   - tagHits = count keywords found in tags (case-insensitive)
   - matchTag = keywords.length === 0 ? 0 : Math.min(1, tagHits/keywords.length) * 0.4
   - heat = (usageCount / maxUsage) * 0.15
   - pref = userPrefIds.has(id) ? 0.05 : 0
   - score = matchType + matchTag + heat + pref
9. Sort desc by score, take top `limit`. Return scored array.

- [ ] **Step 6: Add `recordUsage(input)` method**

Input: `{ snippetId, feedbackId, userId, finalContent?, feedbackStatusAfter? }`
- findByPk snippet; if not found, **silently return** (snippet may have been deleted)
- Transaction:
  - create FeedbackSnippetUsageLog with input fields (defaults: finalContent→null, feedbackStatusAfter→null)
  - update snippet: usageCount += 1, lastUsedAt = new Date()

- [ ] **Step 7: Add `syncFeedbackStatusAfter(feedbackId, newStatus)` method**

For feedback.update() hook (called when feedback status changes):
- If newStatus === 3:
  - `FeedbackSnippetUsageLog.update({ feedbackStatusAfter: 3 }, { where: { feedbackId, feedbackStatusAfter: { [Op.or]: [null, 2] } } })`
- If newStatus < 3:
  - `FeedbackSnippetUsageLog.update({ feedbackStatusAfter: 2 }, { where: { feedbackId, feedbackStatusAfter: 3 } })`

- [ ] **Step 8: Add stats methods**

**`statsOverview()`**:
- total = FeedbackSnippet.count()
- monthlyUsage = FeedbackSnippetUsageLog.count({ where:{ createdAt: >= 30days ago } })
- active = FeedbackSnippet.count({ where: { lastUsedAt: >= 30days ago } })
- closeRate: aggregate from usage_logs → SUM(CASE WHEN feedback_status_after=3 THEN 1 ELSE 0 END) / COUNT(*) * 100, rounded to 1 decimal
- Return `{ total, monthlyUsage, active, closeRate }`

**`statsTop(limit=10)`**:
- findAll on FeedbackSnippet with attributes: id, title, usageCount + literal subquery for closeRate per snippet
- where: status=PUBLISHED
- order [['usageCount','DESC']], limit
- raw:true; map to `{ id, title, usageCount, closeRate }`

**`statsTrend(days=30)`**:
- Clamp days to [7, 90]
- Aggregate FeedbackSnippetUsageLog by `DATE(created_at)`
- Fill missing dates with count=0 (similar to feedback.statsTrend pattern in 019)
- Return `{ items: [{date, count}, ...] }`

**`statsByCategory()`**:
- findAll FeedbackSnippet with attrs: categoryId, SUM(usage_count) as totalUsage, COUNT(id) as snippetCount
- include category for name
- group by categoryId, category.id
- raw:true, nest:true → return `[{ categoryId, categoryName, totalUsage, snippetCount }, ...]`

- [ ] **Step 9: Add export/import methods**

**`exportAll()`**:
- cats = findAll on categories (raw)
- snips = findAll on snippets (raw)
- catCodeById = Map<id, code>
- Return `{ version: '1.0.0', exportedAt: ISO, categories: [...], snippets: [{...with categoryCode resolved}] }`
- Categories include `parentCode` (resolved from parentId via the same map)

**`importData(data, operatorId)`**:
- Validate data.version === '1.0.0'; throw 400 if missing or wrong
- Validate categories.length + snippets.length ≤ 500; throw 422 if exceeded
- Transaction:
  - For each category: find by code (paranoid:true). If exists & isSystem=0, update; if not exists, create. Build codeToIdMap.
  - For each snippet: resolve categoryId from codeToIdMap (throw 422 if categoryCode unknown). Find by code (paranoid:true). If exists & status=DRAFT, update. If not exists, create as DRAFT (status=0). Otherwise skip with reason.
- Return `{ imported: { categories: n, snippets: n }, skipped: [{code, reason}, ...] }`

- [ ] **Step 10: Verify lint**

`read_lints` on the file. Expected: 0 errors.

- [ ] **Step 11: Commit**

```bash
git add super-tool-node/app/service/feedback/snippet.ts
git commit -m "feat(feedback-snippet): add render/recommend/usage/stats/import-export"
```

---
## Task 6: Controllers

**Files:**
- Create: `super-tool-node/app/controller/admin/feedback/snippet_category.ts`
- Create: `super-tool-node/app/controller/admin/feedback/snippet.ts`

- [ ] **Step 1: Create category controller**

`AdminFeedbackSnippetCategoryController extends BaseController`:

**`list()`** GET:
- await ctx.service.feedback.snippetCategory.list()
- this.success(data)

**`detail()`** GET /:id:
- id = Number(ctx.params.id)
- data = await snippetCategory.detail(id)
- this.success(data)

**`create()`** POST:
- this.validate({ code:{type:'string',min:1,max:64}, name:{type:'string',min:1,max:50}, parentId:{type:'integer',required:false}, description:{type:'string',required:false,max:255}, feedbackType:{type:'enum',values:['bug','suggestion','praise','other'],required:false}, icon:{type:'string',required:false,max:64}, color:{type:'string',required:false,max:16}, sortOrder:{type:'integer',required:false}, status:{type:'enum',values:[0,1],required:false} })
- audit.log: module='feedback-snippet-category' action='create'
- created = await snippetCategory.create(body)
- this.created(created)

**`update()`** PUT /:id:
- id = Number(ctx.params.id)
- this.validate (same fields, all required:false)
- audit.log with beforeData=detail(id), action='update'
- updated = await snippetCategory.update(id, body); this.success(updated)

**`destroy()`** DELETE /:id:
- audit.log; await snippetCategory.destroy(id); this.success(null, '删除成功')

**`setRolePermissions()`** PUT /:id/role-permissions:
- this.validate({ roleIds: { type:'array', itemType:'integer' } })
- result = await snippetCategory.setRolePermissions(id, body.roleIds)
- audit.log; this.success(result)

**`getRolePermissions()`** GET /:id/role-permissions (optional, used in admin UI to show current state):
- ids = await snippetCategory.getRolePermissions(id)
- this.success({ roleIds: ids })

- [ ] **Step 2: Create snippet controller**

`AdminFeedbackSnippetController extends BaseController`:

**`list()`** GET:
- q = ctx.query, parse numbers/enums
- result = await snippet.list(q); this.success(result)

**`detail()`** GET /:id:
- this.success(await snippet.detail(id))

**`create()`** POST:
- this.validate({ categoryId:{type:'integer'}, code:{type:'string',min:1,max:64}, title:{type:'string',min:1,max:100}, content:{type:'string',min:10,max:5000}, tags:{type:'string',required:false,max:255}, sampleVariables:{type:'object',required:false}, description:{type:'string',required:false,max:500} })
- created = await snippet.create(body, ctx.state.user.id)
- audit.log; this.created(created)

**`update()`** PUT /:id:
- this.validate (all optional)
- audit.log with beforeData=detail
- updated = await snippet.update(id, body, ctx.state.user.id); this.success(updated)

**`destroy()`** DELETE /:id:
- audit.log; await snippet.destroy(id); this.success(null, '删除成功')

**`publish()`** POST /:id/publish:
- this.validate({ changeNote:{type:'string',required:false,max:500} })
- audit.log
- result = await snippet.publish(id, ctx.state.user.id, body.changeNote); this.success(result, '发布成功')

**`disable()`** POST /:id/disable:
- audit.log
- result = await snippet.disable(id, ctx.state.user.id); this.success(result, '已停用')

**`listVersions()`** GET /:id/versions:
- this.success(await snippet.listVersions(id))

**`rollback()`** POST /:id/rollback/:versionId:
- audit.log
- result = await snippet.rollback(snippetId, versionId, ctx.state.user.id); this.success(result, '回滚成功')

**`render()`** POST /:id/render:
- this.validate({ feedbackId:{type:'integer',required:false}, customVars:{type:'object',required:false} })
- result = await snippet.render(id, body.customVars||{}, body.feedbackId)
- this.success(result)

**`recordUsage()`** POST /:id/usage:
- this.validate({ feedbackId:{type:'integer'}, finalContent:{type:'string',required:false,max:5000} })
- await snippet.recordUsage({ snippetId:id, feedbackId, userId:ctx.state.user.id, finalContent, feedbackStatusAfter: 2 })
- this.success({ ok: true })

**`recommend()`** GET (no :id, uses query feedbackId):
- this.validate ON QUERY: feedbackId required
- limit = ctx.query.limit ? Number : 5
- result = await snippet.recommend(Number(ctx.query.feedbackId), ctx.state.user.id, limit)
- this.success(result)

**`statsOverview/Top/Trend/ByCategory()`**:
- Each call corresponding service method, this.success(data)

**`exportAll()`** GET (returns plain JSON, not wrapped):
- data = await snippet.exportAll()
- this.ctx.set('Content-Disposition', `attachment; filename="feedback-snippets-${new Date().toISOString().slice(0,10)}.json"`)
- this.ctx.body = data  (umi-request will handle download)

**`importData()`** POST:
- this.validate({ version:{type:'string'}, categories:{type:'array',required:false}, snippets:{type:'array',required:false} })
- audit.log
- result = await snippet.importData(body, ctx.state.user.id)
- this.success(result, '导入完成')

- [ ] **Step 3: Verify lint** on both controller files. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add super-tool-node/app/controller/admin/feedback/
git commit -m "feat(feedback-snippet): add category and snippet controllers"
```

---

## Task 7: feedback Service Hook + Router Registration

**Files:**
- Modify: `super-tool-node/app/service/feedback.ts`
- Modify: `super-tool-node/app/router.ts`

- [ ] **Step 1: Modify feedback.reply() to accept snippetId**

In `service/feedback.ts`:
- Change `reply(id, replyContent, replyUserId)` signature → `reply(id, replyContent, replyUserId, snippetId?)`
- After existing `update + notification` logic, if `snippetId` provided:
  ```typescript
  try {
    await this.ctx.service.feedback.snippet.recordUsage({
      snippetId, feedbackId: id, userId: replyUserId,
      finalContent: replyContent, feedbackStatusAfter: 2,
    });
  } catch (e: any) {
    this.ctx.logger.warn(`[feedback.reply] recordUsage failed: ${e.message}`);
  }
  ```

- [ ] **Step 2: Modify feedback.update() to sync feedback_status_after**

In `service/feedback.ts:update()`, after the status notification block, append:
```typescript
// 同步话术使用记录的 feedback_status_after
if (payload.status !== undefined && fromStatus !== payload.status) {
  try {
    await this.ctx.service.feedback.snippet.syncFeedbackStatusAfter(id, payload.status);
  } catch (e: any) {
    this.ctx.logger.warn(`[feedback.update] syncFeedbackStatusAfter failed: ${e.message}`);
  }
}
```

- [ ] **Step 3: Modify admin feedback controller to pass snippetId from request body**

In `controller/admin/feedback.ts:reply()`:
- Add to validate: `snippetId: { type: 'integer', required: false }`
- Pass to service: `await this.service.feedback.reply(id, replyContent, replyUserId, body.snippetId)`

- [ ] **Step 4: Register routes in `app/router.ts`**

After existing feedback admin routes (around line 110), add:

```typescript
// ==================== 反馈话术分类 ====================
router.get('/api/admin/feedback/snippet-categories', auth, perm('feedback:snippet:category:list'), adminCtrl.feedback.snippetCategory.list);
router.post('/api/admin/feedback/snippet-categories', auth, perm('feedback:snippet:category:create'), adminCtrl.feedback.snippetCategory.create);
router.get('/api/admin/feedback/snippet-categories/:id/role-permissions', auth, perm('feedback:snippet:category:role-perm'), adminCtrl.feedback.snippetCategory.getRolePermissions);
router.put('/api/admin/feedback/snippet-categories/:id/role-permissions', auth, perm('feedback:snippet:category:role-perm'), adminCtrl.feedback.snippetCategory.setRolePermissions);
router.put('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:update'), adminCtrl.feedback.snippetCategory.update);
router.delete('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:delete'), adminCtrl.feedback.snippetCategory.destroy);
router.get('/api/admin/feedback/snippet-categories/:id', auth, perm('feedback:snippet:category:list'), adminCtrl.feedback.snippetCategory.detail);

// ==================== 反馈话术 ====================
// 注意：精确路径（recommend/export/import/stats）必须放在 :id 之前
router.get('/api/admin/feedback/snippets/recommend', auth, perm('feedback:snippet:recommend'), adminCtrl.feedback.snippet.recommend);
router.get('/api/admin/feedback/snippets/export', auth, perm('feedback:snippet:export'), adminCtrl.feedback.snippet.exportAll);
router.post('/api/admin/feedback/snippets/import', auth, perm('feedback:snippet:export'), adminCtrl.feedback.snippet.importData);
router.get('/api/admin/feedback/snippets/stats/overview', auth, perm('feedback:snippet:stats'), adminCtrl.feedback.snippet.statsOverview);
router.get('/api/admin/feedback/snippets/stats/top', auth, perm('feedback:snippet:stats'), adminCtrl.feedback.snippet.statsTop);
router.get('/api/admin/feedback/snippets/stats/trend', auth, perm('feedback:snippet:stats'), adminCtrl.feedback.snippet.statsTrend);
router.get('/api/admin/feedback/snippets/stats/by-category', auth, perm('feedback:snippet:stats'), adminCtrl.feedback.snippet.statsByCategory);

router.get('/api/admin/feedback/snippets', auth, perm('feedback:snippet:view'), adminCtrl.feedback.snippet.list);
router.post('/api/admin/feedback/snippets', auth, perm('feedback:snippet:create'), adminCtrl.feedback.snippet.create);
router.get('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:view'), adminCtrl.feedback.snippet.detail);
router.put('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:update'), adminCtrl.feedback.snippet.update);
router.delete('/api/admin/feedback/snippets/:id', auth, perm('feedback:snippet:delete'), adminCtrl.feedback.snippet.destroy);
router.post('/api/admin/feedback/snippets/:id/publish', auth, perm('feedback:snippet:publish'), adminCtrl.feedback.snippet.publish);
router.post('/api/admin/feedback/snippets/:id/disable', auth, perm('feedback:snippet:publish'), adminCtrl.feedback.snippet.disable);
router.get('/api/admin/feedback/snippets/:id/versions', auth, perm('feedback:snippet:view'), adminCtrl.feedback.snippet.listVersions);
router.post('/api/admin/feedback/snippets/:id/rollback/:versionId', auth, perm('feedback:snippet:publish'), adminCtrl.feedback.snippet.rollback);
router.post('/api/admin/feedback/snippets/:id/render', auth, perm('feedback:snippet:render'), adminCtrl.feedback.snippet.render);
router.post('/api/admin/feedback/snippets/:id/usage', auth, perm('feedback:snippet:usage'), adminCtrl.feedback.snippet.recordUsage);
```

> **Note**: `import` reuses `feedback:snippet:export` permission code (or split into separate permission if needed). Plan uses single code for simplicity.

- [ ] **Step 5: Verify lint** on modified files. Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add super-tool-node/app/service/feedback.ts super-tool-node/app/controller/admin/feedback.ts super-tool-node/app/router.ts
git commit -m "feat(feedback-snippet): integrate with feedback.reply/update + register routes"
```

---
## Task 8: Admin Frontend - Service + Routes Config

**Files:**
- Create: `super-tools-admin/src/services/feedbackSnippet.ts`
- Modify: `super-tools-admin/config/routes/modules/feedback.ts`
- Modify: `super-tools-admin/src/services/feedback.ts`
- Create: `super-tools-admin/src/utils/snippetVars.ts`

- [ ] **Step 1: Create snippet API service**

`src/services/feedbackSnippet.ts` exports type definitions + API functions:

**Types**:
- `FeedbackSnippetCategory`: id, parentId, code, name, description, feedbackType, icon, color, sortOrder, status, isSystem
- `FeedbackSnippet`: id, categoryId, code, title, content, tags, sampleVariables, currentVersion, status, usageCount, lastUsedAt, createdAt, updatedAt, creator?, category?
- `FeedbackSnippetVersion`: id, snippetId, version, title, content, tags, sampleVariables, changeNote, publisher?, publishedAt
- Status enum: 0草稿 / 1已发布 / 2已停用

**API Functions** (use `request` from `@/utils/request`):

Categories:
```typescript
listSnippetCategories() // GET /api/admin/feedback/snippet-categories
createSnippetCategory(data) // POST
updateSnippetCategory(id, data) // PUT /:id
deleteSnippetCategory(id) // DELETE /:id
getCategoryRolePermissions(id) // GET /:id/role-permissions
setCategoryRolePermissions(id, roleIds) // PUT /:id/role-permissions
```

Snippets:
```typescript
listSnippets(params)
getSnippet(id)
createSnippet(data)
updateSnippet(id, data)
deleteSnippet(id)
publishSnippet(id, changeNote?)
disableSnippet(id)
listSnippetVersions(id)
rollbackSnippet(id, versionId)
renderSnippet(id, { feedbackId?, customVars? })
recordSnippetUsage(id, { feedbackId, finalContent? })
recommendSnippets(feedbackId, limit?) // GET ?feedbackId=&limit=
```

Stats:
```typescript
getSnippetStatsOverview()
getSnippetStatsTop(limit?)
getSnippetStatsTrend({ days? })
getSnippetStatsByCategory()
```

Import/Export:
```typescript
exportSnippets() // GET /export, returns blob
importSnippets(data) // POST /import
```

- [ ] **Step 2: Modify existing feedback.ts service**

In `src/services/feedback.ts`, modify `replyFeedback`:
```typescript
export async function replyFeedback(id: number, replyContent: string, snippetId?: number) {
  return request(`/api/admin/feedbacks/${id}/reply`, {
    method: 'POST',
    data: { replyContent, ...(snippetId ? { snippetId } : {}) },
  });
}
```

- [ ] **Step 3: Modify routes config**

In `config/routes/modules/feedback.ts`, add 2 new routes after `/feedback/stats`:

```typescript
{
  path: '/feedback/snippets',
  component: '@/pages/Feedback/Snippets',
  wrappers: ['@/components/AuthWrapper'],
},
{
  path: '/feedback/snippets/stats',
  component: '@/pages/Feedback/Snippets/Stats',
  wrappers: ['@/components/AuthWrapper'],
},
```

- [ ] **Step 4: Create snippetVars helper**

`src/utils/snippetVars.ts`:

```typescript
const PLACEHOLDER_RE = /\{\{([\w.]+)\}\}/g;
const BUILT_IN_VARS = new Set(['userName', 'feedbackId', 'feedbackType', 'adminName', 'currentDate']);

/** 抓出模板里所有 {{var}} 占位符 */
export function extractVars(template: string): string[] {
  const set = new Set<string>();
  let m;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) set.add(m[1]);
  return Array.from(set);
}

/** 区分内置和自定义变量 */
export function classifyVars(vars: string[]): { builtIn: string[]; custom: string[] } {
  const builtIn: string[] = []; const custom: string[] = [];
  vars.forEach(v => (BUILT_IN_VARS.has(v) ? builtIn : custom).push(v));
  return { builtIn, custom };
}

/** 简单本地渲染（前端预览用，与后端 templateRenderer 行为一致） */
export function localRender(template: string, vars: Record<string, any>): string {
  return template.replace(PLACEHOLDER_RE, (match, path) => {
    const parts = path.split('.');
    let cur: any = vars;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return match;
      cur = cur[p];
    }
    return cur === undefined ? match : String(cur);
  });
}
```

- [ ] **Step 5: Verify lint** on all 4 files (1 new + 3 modified). Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add super-tools-admin/src/services/feedbackSnippet.ts super-tools-admin/src/services/feedback.ts super-tools-admin/config/routes/modules/feedback.ts super-tools-admin/src/utils/snippetVars.ts
git commit -m "feat(feedback-snippet): add admin services + routes + var utils"
```

---

## Task 9: Admin Frontend - Snippets Main Page

**Files:**
- Create: `super-tools-admin/src/pages/Feedback/Snippets/index.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/index.less`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/CategoryTree.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/SnippetEditDrawer.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/VersionHistoryDrawer.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/CategoryRolePermDrawer.tsx`

- [ ] **Step 1: Create main page `index.tsx`**

Page layout:
- Card with title "话术管理" + extra (toolbar: 新建分类/新建话术/导入/导出 + 关键词搜索)
- Body: Row with two columns
  - Left col (xs=24, md=6): `<CategoryTree>` (selectable, current selected → controls right table filter)
  - Right col (xs=24, md=18): `<Table>` of snippets with:
    - filters: status (Select), tag (Input), keyword (Search) at top
    - columns: 标题, 分类, 标签 (Tag list split by '|'), 状态 (StatusTag), 使用次数, 最近使用 (formatDateTime), 操作
    - actions: 详情 (Modal preview) / 编辑 / 发布(草稿态)/停用(已发布态) / 版本 / 删除
    - `<AuthButton permCode="feedback:snippet:manage">` wraps edit/delete
    - `<AuthButton permCode="feedback:snippet:publish">` wraps publish/disable/version
  - Pagination: page/pageSize state
- Drawers (lazy-rendered):
  - `<SnippetEditDrawer>` for create/edit
  - `<VersionHistoryDrawer>` for view/rollback versions
  - `<CategoryRolePermDrawer>` triggered from CategoryTree's right-click menu (or separate button)

State management:
- categories (list, fetched via listSnippetCategories on mount)
- selectedCategoryId (controls table filter)
- snippets, total, loading, page, pageSize
- search keyword, status filter, tag filter
- editDrawer: { visible, mode: 'create'|'edit', target }
- versionDrawer: { visible, snippetId }
- rolePermDrawer: { visible, categoryId }

Effects:
- on mount: fetchCategories
- on filter/page change: fetchSnippets

Import handler:
- file input → `JSON.parse(text)` → `await importSnippets(data)` → message.success with imported counts → refresh
- file size validation: ≤ 5MB

Export handler:
- `await exportSnippets()` returns blob → trigger download (`URL.createObjectURL`)

- [ ] **Step 2: Create main page styles `index.less`**

Minimal styles:
- `.snippets-page { .ant-card-body { padding: 16px; } }`
- `.snippets-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:8px; flex-wrap:wrap; }`
- `.snippets-tags-cell .ant-tag { margin-right:4px; margin-bottom:4px; }`

- [ ] **Step 3: Create `CategoryTree.tsx`**

Component props: `{ categories, selectedKey, onSelect, onCreate, onEdit, onDelete, onConfigRolePerm }`.

Body:
- `<Tree>` from antd with treeData built from categories (parent_id → children recursion)
- Show node title with name + (snippets count) + isSystem badge
- Each node has Dropdown menu trigger on right side (icon button) with: 新建子分类 / 编辑 / 删除 / 配置角色权限
- Disable 删除/编辑 for isSystem=1 nodes
- Selectable single, controlled by selectedKey

- [ ] **Step 4: Create `SnippetEditDrawer.tsx`**

Drawer width=720, two-step form (use Steps):
- Step 1 (基础信息): code (disabled in edit mode), title, categoryId (TreeSelect from categories), tags (Select mode='tags' with split on '|'), description
- Step 2 (内容编辑): content (TextArea rows=10 maxLength=5000 showCount), 实时检测变量并显示提示行（"该话术包含变量：{{userName}}, {{orderNo}}..."）, sampleVariables (object editor — simple textarea JSON for sample values)
- Footer:
  - mode='create': 保存草稿 button
  - mode='edit': 保存 (if status=DRAFT) / 提示已发布不可编辑

Validation:
- code: required, 1-64 chars, ascii + dash + underscore + colon
- title: required 1-100
- content: required 10-5000
- categoryId: required
- tags: max 10 items, each ≤ 20 chars

On submit:
- create: `await createSnippet(values)` → onSuccess + close
- edit: `await updateSnippet(id, values)` → onSuccess + close

- [ ] **Step 5: Create `VersionHistoryDrawer.tsx`**

Drawer width=600:
- Fetch `listSnippetVersions(snippetId)` on open
- `<Timeline>` of versions: each item shows `v{version}` + publisher + publishedAt + changeNote, with action button "回滚" (Popconfirm) and "查看内容" (Modal preview the version's title+content)
- Wrap rollback button with `<AuthButton permCode="feedback:snippet:publish">`

Rollback handler:
- `await rollbackSnippet(snippetId, versionId)` → message.success → refresh + close + parent refresh

- [ ] **Step 6: Create `CategoryRolePermDrawer.tsx`**

Drawer width=480:
- Fetch `getCategoryRolePermissions(categoryId)` on open + global role list (from `services/role.ts` or similar — check existing pattern)
- Show CheckboxGroup of all roles with current selection pre-checked
- Helper text: "未勾选任何角色 → 所有角色均可使用该分类下的话术"
- 保存 button: `await setCategoryRolePermissions(categoryId, selectedRoleIds)`

> **Note**: Role list fetching — check if there's existing service `listRoles()` in `src/services/role.ts`. If yes, reuse. If no, fetch via `request('/api/admin/roles?platform=admin&pageSize=200')`.

- [ ] **Step 7: Verify lint** on all 6 files. Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add super-tools-admin/src/pages/Feedback/Snippets/
git commit -m "feat(feedback-snippet): add admin snippets main page + CRUD drawers"
```

---
## Task 10: Admin Frontend - Stats Page

**Files:**
- Create: `super-tools-admin/src/pages/Feedback/Snippets/Stats/index.tsx`
- Create: `super-tools-admin/src/pages/Feedback/Snippets/Stats/index.less`

- [ ] **Step 1: Create stats page**

Mirror `pages/Feedback/Stats/index.tsx` structure:

Top:
- Card title "话术统计" + extra (Select days [7/30/90] + Refresh button)

Concept cards (Row gutter=16, 4 cols):
- 话术总数 (overview.total) — icon: BookOutlined
- 本月使用次数 (overview.monthlyUsage) — icon: PlayCircleOutlined  blue
- 活跃话术数 (overview.active) — icon: FireOutlined orange
- 平均关闭率 (overview.closeRate + '%') — icon: CheckCircleOutlined green

Charts row 1 (2 cols):
- 热门话术 Top 10 (Card): Table small with columns 排名/标题/使用次数/关闭率(%); rank=index+1, fetch via getSnippetStatsTop(10)
- 使用趋势折线图 (Card): `<Line>` from @ant-design/charts; data via getSnippetStatsTrend({days}); xField='date', yField='count'; height=280

Charts row 2 (2 cols):
- 按分类分布 (Card): `<Pie>` with data getSnippetStatsByCategory(); angleField='totalUsage', colorField='categoryName', radius=0.85, height=260
- 关闭率排行 (Card): same data as Top 10 but sorted by closeRate desc; small table

Effects:
- Three loading states: loadingOverview, loadingTrend, loadingTop, loadingByCategory
- Refresh handler: fetch all in parallel via Promise.all
- on days change: fetchTrend(days)

- [ ] **Step 2: Create stats styles `Stats/index.less`**

```less
.snippet-stats-page {
  .stat-cards { margin-bottom: 24px; }
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    @media (max-width: 992px) { grid-template-columns: 1fr; }
  }
  .empty-chart {
    display: flex; align-items: center; justify-content: center;
    min-height: 220px; color: #999; font-size: 13px;
  }
}
```

- [ ] **Step 3: Verify lint** on both files. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add super-tools-admin/src/pages/Feedback/Snippets/Stats/
git commit -m "feat(feedback-snippet): add admin stats page"
```

---

## Task 11: SnippetPicker Component + DetailDrawer Integration

**Files:**
- Create: `super-tools-admin/src/components/SnippetPicker/index.tsx`
- Create: `super-tools-admin/src/components/SnippetPicker/index.less`
- Modify: `super-tools-admin/src/pages/Feedback/List/DetailDrawer.tsx`

- [ ] **Step 1: Create `SnippetPicker` component**

`src/components/SnippetPicker/index.tsx`:

Props:
```typescript
interface SnippetPickerProps {
  feedbackId: number;        // 当前反馈 ID（用于推荐和渲染）
  onPick: (content: string, snippetId: number) => void;  // 选中后回调，把渲染好的内容与 snippetId 抛给父组件
}
```

UI:
- Toolbar row (3 buttons / inputs side by side):
  - **💡 智能推荐** (Popover trigger):
    - Popover content: List of recommended Top 5 snippets (from `recommendSnippets(feedbackId, 5)` on Popover open)
    - Each item: title + tags + score + "插入" button
  - **📋 选择话术** (Modal trigger):
    - Modal width=900: left col分类 Select cascader + 状态 filter + 关键词 search; right col Table list of snippets (active filter)
    - Columns: title / category / tags / 操作 (插入)
    - Use `listSnippets({ status: 1 })` paginated
  - **🔍 搜索话术** (Input.Search inline):
    - On enter: `listSnippets({ keyword, status: 1, pageSize: 10 })` → AutoComplete dropdown of results

Pick handler `handlePick(snippet)`:
1. Extract vars from snippet.content via `extractVars`
2. Classify built-in vs custom via `classifyVars`
3. Call backend render: `renderSnippet(snippet.id, { feedbackId, customVars: {} })` to get content with built-in vars filled
4. If `result.missingVars.length > 0` (custom vars detected):
   - Open Modal "填写自定义变量" with Form.Item for each custom var (using snippet.sampleVariables as placeholder)
   - On submit: re-render via `renderSnippet(id, { feedbackId, customVars: filledVars })`
5. Call `props.onPick(finalContent, snippet.id)`
6. Close Popover/Modal

Auth wrapper: wrap entire toolbar in `<AuthButton permCode="feedback:snippet:use">` so users without permission don't see picker.

- [ ] **Step 2: Create styles `index.less`**

```less
.snippet-picker {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  flex-wrap: wrap;

  &__recommend-list { max-height: 360px; overflow-y: auto; min-width: 320px; }
  &__recommend-item {
    padding: 8px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
    &:hover { background: #fafafa; }
    &-title { font-weight: 500; }
    &-tags { font-size: 12px; color: #999; margin-top: 4px; }
    &-score { font-size: 11px; color: #1890ff; }
  }
  &__search { width: 240px; }
}
```

- [ ] **Step 3: Modify `DetailDrawer.tsx` to integrate picker**

In `src/pages/Feedback/List/DetailDrawer.tsx`:

1. Import:
```typescript
import SnippetPicker from '@/components/SnippetPicker';
```

2. Add state:
```typescript
const [pickedSnippetId, setPickedSnippetId] = useState<number | null>(null);
```

3. In the reply Form (around the existing `<Form.Item label="回复内容" ...>`), replace the section to add SnippetPicker BEFORE TextArea:

```tsx
<Form form={form} layout="vertical">
  {/* 话术选择器 */}
  {detail && (detail.status === 0 || detail.status === 1) && (
    <SnippetPicker
      feedbackId={detail.id}
      onPick={(content, snippetId) => {
        form.setFieldValue('replyContent', content);
        setPickedSnippetId(snippetId);
      }}
    />
  )}

  <Form.Item
    label="回复内容" name="replyContent"
    rules={[
      { required: true, message: '请输入回复内容' },
      { min: 1, max: 2000, message: '1-2000 字符' },
    ]}
  >
    <Input.TextArea
      rows={6} maxLength={2000} showCount
      onChange={(e) => {
        // 用户手动改动则取消 snippetId 关联（避免误统计）
        if (pickedSnippetId !== null) {
          // 若用户改动幅度大可清空 pickedSnippetId（这里保留宽松策略：一旦修改即清除）
          setPickedSnippetId(null);
        }
      }}
    />
  </Form.Item>
  {/* ...提交按钮... */}
</Form>
```

4. Modify `handleReply()`:

```typescript
const handleReply = async () => {
  if (!detail) return;
  try {
    const { replyContent } = await form.validateFields();
    setSubmitting(true);
    const res: any = await replyFeedback(detail.id, replyContent, pickedSnippetId || undefined);
    if (res?.code === 200) {
      message.success('回复成功');
      setPickedSnippetId(null);
      await refetch(detail.id);
      onSuccess();
    } else {
      message.error(res?.message || '回复失败');
    }
  } catch {} finally { setSubmitting(false); }
};
```

5. Reset `pickedSnippetId` when drawer closes (in existing useEffect when visible=false):
```typescript
} else if (!visible) {
  setDetail(null);
  setPickedSnippetId(null);
}
```

> **Note on UX choice**: We clear `pickedSnippetId` whenever the user types in the textarea (after pick). Rationale: any manual modification means the user adapted the snippet, so the usage record should still credit the snippet. Alternative: keep snippetId regardless. For MVP we choose **clear on edit** to avoid over-attribution.

> **Decision pending review**: If you want to keep snippetId even after user edits, change the onChange handler to NOT clear it. Discuss with reviewer if needed.

- [ ] **Step 4: Verify lint** on all 3 files. Expected: 0 errors.

- [ ] **Step 5: Manual smoke test prep checklist**

Document test scenarios in the commit message:
1. Open feedback list → click row → Drawer opens with reply form + SnippetPicker visible
2. Click 💡 智能推荐 → Popover shows top 5 with scores
3. Click 选择话术 → Modal opens with full library; pick one → content inserted into TextArea
4. Pick a snippet with `{{orderNo}}` custom var → variable form modal opens → fill → final content inserted
5. Submit reply → backend records usage_log + snippet.usage_count++
6. Open snippet stats page → see usage trend reflect the new record

- [ ] **Step 6: Commit**

```bash
git add super-tools-admin/src/components/SnippetPicker/ super-tools-admin/src/pages/Feedback/List/DetailDrawer.tsx
git commit -m "feat(feedback-snippet): add SnippetPicker + integrate into reply flow"
```

---
## Task 12: Final Integration Verification

- [ ] **Step 1: Backend TypeScript compilation check**

```bash
cd d:\Donough\Projects\super-tools\super-tool-node
npx tsc --noEmit > ts-errors.tmp.txt 2>&1
```

Read the file. Expected: only pre-existing test errors (count ≤ 30, all in `test/notification/lib/*.test.ts` for missing `expect`). No errors in `app/model/feedback_snippet*.ts` / `app/service/feedback/*.ts` / `app/controller/admin/feedback/*.ts` / `app/router.ts`.

Cleanup: `Remove-Item ts-errors.tmp.txt`

- [ ] **Step 2: Verify all new files exist**

```bash
cd d:\Donough\Projects\super-tools

# Backend (10 files)
$backend = @(
  'super-tool-node/database/020_add_feedback_snippets.sql',
  'super-tool-node/app/model/feedback_snippet_category.ts',
  'super-tool-node/app/model/feedback_snippet.ts',
  'super-tool-node/app/model/feedback_snippet_version.ts',
  'super-tool-node/app/model/feedback_snippet_usage_log.ts',
  'super-tool-node/app/service/feedback/snippet_category.ts',
  'super-tool-node/app/service/feedback/snippet.ts',
  'super-tool-node/app/controller/admin/feedback/snippet_category.ts',
  'super-tool-node/app/controller/admin/feedback/snippet.ts'
)
$backend | ForEach-Object { Test-Path $_ }

# Admin (10 files)
$admin = @(
  'super-tools-admin/src/services/feedbackSnippet.ts',
  'super-tools-admin/src/utils/snippetVars.ts',
  'super-tools-admin/src/pages/Feedback/Snippets/index.tsx',
  'super-tools-admin/src/pages/Feedback/Snippets/index.less',
  'super-tools-admin/src/pages/Feedback/Snippets/CategoryTree.tsx',
  'super-tools-admin/src/pages/Feedback/Snippets/SnippetEditDrawer.tsx',
  'super-tools-admin/src/pages/Feedback/Snippets/VersionHistoryDrawer.tsx',
  'super-tools-admin/src/pages/Feedback/Snippets/CategoryRolePermDrawer.tsx',
  'super-tools-admin/src/pages/Feedback/Snippets/Stats/index.tsx',
  'super-tools-admin/src/components/SnippetPicker/index.tsx'
)
$admin | ForEach-Object { Test-Path $_ }
```

Expected: All True.

- [ ] **Step 3: Run lint on all changed files**

Use `read_lints` tool with paths:
- `super-tool-node/app`
- `super-tools-admin/src`

Expected: No new errors in feedback-snippet files (pre-existing project errors are acceptable).

- [ ] **Step 4: Verify git log**

```bash
cd d:\Donough\Projects\super-tools
git log --oneline -15
```

Expected: 11 new feedback-snippet commits + plan/spec docs.

- [ ] **Step 5: Generate diff summary**

```bash
git diff --stat master..HEAD
```

Expected: ~20+ files, ~3000+ insertions.

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Implemented in Task |
|---|---|
| 5 tables | Task 1 (migration) + Task 2 (models) |
| Category tree CRUD + role permissions | Task 3 (service) + Task 6 (controller) |
| Snippet CRUD with draft/publish/disable status machine | Task 4 |
| Version snapshot + rollback | Task 4 |
| Smart recommendation (4-factor scoring) | Task 5 |
| Variable substitution (built-in + custom) | Task 5 + utils + SnippetPicker (Task 11) |
| Usage tracking (usage_count + last_used_at + log) | Task 5 |
| Status sync hook (feedback_status_after) | Task 5 + Task 7 |
| Stats: overview + top + trend + by-category | Task 5 + Task 10 |
| JSON import/export | Task 5 + Task 9 (UI in main page) |
| RBAC permissions (1 dir + 2 menus + 5 buttons + 14 APIs) | Task 1 (migration seed) |
| Routes registration | Task 7 |
| Admin main page (left tree + right table) | Task 9 |
| Stats page (4 cards + trend + 2 pie charts) | Task 10 |
| SnippetPicker component (recommend / library / search) | Task 11 |
| DetailDrawer integration | Task 11 |
| 6 system seed snippets + 4 categories | Task 1 |

### Type Consistency Check

- `FeedbackSnippet`, `FeedbackSnippetCategory` types referenced in service / controller / admin service consistently
- `recordUsage` parameter shape `{ snippetId, feedbackId, userId, finalContent?, feedbackStatusAfter? }` consistent across Task 5 + Task 7 + Task 11
- `recommend` returns scored list with `{ ...snippet, score }` consistently
- `STATUS_DRAFT/PUBLISHED/DISABLED` constants used in service (0/1/2 values match migration enum semantics)

### Placeholder Scan

No "TODO" / "TBD" / "implement later" found. All steps include either complete code or explicit reference to existing patterns (e.g., "mirror notification/template.ts:rollbackToVersion").

### Scope Check

11 tasks, ~76 minutes total estimate. Single implementation plan is appropriate; no decomposition needed.

---

## Execution Notes

### Pre-execution

1. Confirm current branch is clean OR create a feature branch:
   ```bash
   cd d:\Donough\Projects\super-tools
   git checkout -b feat/feedback-snippets
   ```

2. The reference patterns (notification/template.ts, notification/templates page, feedback DetailDrawer) should be re-read before implementing Tasks 4, 5, 9, 11.

### During execution

- Use **subagent-driven-development** skill: dispatch a fresh subagent per task with the full task text + context.
- Each task should commit atomically (one task = one commit).
- After each task, briefly verify with `read_lints` on changed files.

### Post-execution

- Run migration: `mysql < super-tool-node/database/020_add_feedback_snippets.sql`
- Restart backend
- Smoke test the picker flow per Task 11 Step 5 checklist
- Optional: write a regression test under `super-tool-node/test/api/feedback-snippet.test.ts` (not in plan; for follow-up)

---

## Final File Tally

**Created (20 files)**:
- 1 migration
- 4 models
- 2 services
- 2 controllers
- 1 admin services
- 1 utils
- 4 admin pages (Snippets/ folder)
- 1 admin stats page
- 1 SnippetPicker component
- 3 less files

**Modified (5 files)**:
- `super-tool-node/app/service/feedback.ts`
- `super-tool-node/app/controller/admin/feedback.ts`
- `super-tool-node/app/router.ts`
- `super-tools-admin/src/services/feedback.ts`
- `super-tools-admin/config/routes/modules/feedback.ts`
- `super-tools-admin/src/pages/Feedback/List/DetailDrawer.tsx`

(Total 26 files)
