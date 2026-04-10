# PR C-3: SchemaDrivenForm (react-hook-form + zod)

> Phase C | 의존: C-1 | Wave: W2 (C-2와 병렬)

---

## 목표
ConfigSchema(JSON Schema subset)에서 자동으로 폼 UI 생성.
react-hook-form + zod 검증 통합. 장르별 ConfigSchema를 클라이언트에서 검증.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/RightPanel/
    SchemaDrivenForm.tsx         # ConfigSchema → 자동 폼 (메인)
    SchemaField.tsx              # 개별 필드 렌더러
    fields/
      StringField.tsx            # text / textarea
      NumberField.tsx            # integer + min/max
      BooleanField.tsx           # toggle switch
      SelectField.tsx            # enum dropdown
      ArrayField.tsx             # array editor
  hooks/
    useSchemaToZod.ts           # JSON Schema → Zod schema 변환
    useSchemaToForm.ts          # 폼 초기값 + 검증 schema
  utils/
    schemaParser.ts             # JSON Schema → FormFieldSpec[]
```

## FormFieldSpec 타입

```typescript
interface FormFieldSpec {
  key: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  label: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  required: boolean;
  items?: FormFieldSpec;
  properties?: FormFieldSpec[];
}
```

## JSON Schema → Zod 변환

지원: `type`, `properties`, `required`, `enum`, `minimum`, `maximum`, `default`, `description`, `items`
미지원: `allOf`, `oneOf`, `anyOf`, `not`, `patternProperties`, `dependencies`

```typescript
function schemaToZod(schema: JsonSchema): z.ZodType {
  switch (schema.type) {
    case 'string':
      return schema.enum ? z.enum(schema.enum) : z.string();
    case 'integer': case 'number': {
      let n = z.number();
      if (schema.minimum !== undefined) n = n.min(schema.minimum);
      if (schema.maximum !== undefined) n = n.max(schema.maximum);
      return n;
    }
    case 'boolean': return z.boolean();
    case 'array': return z.array(schemaToZod(schema.items!));
    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      for (const [key, prop] of Object.entries(schema.properties ?? {}))
        shape[key] = schemaToZod(prop);
      return z.object(shape);
    }
  }
}
```

## 필드 렌더링 규칙

| JSON Schema type | Component | Props |
|-----------------|-----------|-------|
| string (no enum) | `StringField` | text, maxLength |
| string (with enum) | `SelectField` | dropdown options |
| integer/number | `NumberField` | min, max, step |
| boolean | `BooleanField` | toggle switch |
| array | `ArrayField` | recursive item type |
| object | `SchemaDrivenForm` | recursive children |

## 테스트

- `schemaParser.test.ts`: JSON Schema → FormFieldSpec (10+ 케이스)
- `useSchemaToZod.test.ts`: 4장르 ConfigSchema → Zod → 검증
- `SchemaDrivenForm.test.tsx`: 모든 필드 타입 렌더링 + interaction
- **크로스 검증**: 장르 ConfigSchema로 생성된 폼이 모든 필드를 렌더링
