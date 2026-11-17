import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Content } from "@react-spectrum/s2/Content";
import { Divider } from "@react-spectrum/s2/Divider";
import { Heading } from "@react-spectrum/s2/Heading";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Text } from "@react-spectrum/s2/Text";
import { ToggleButton } from "@react-spectrum/s2/ToggleButton";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FieldEditor } from "../components/field-editor.tsx";
import { FieldsList } from "../components/fields-list.tsx";
import { FormPreview } from "../components/form-preview.tsx";
import { useFieldsApi } from "../hooks/use-fields-api.ts";
import { editableCopy, emptyField } from "../lib/fields.ts";

import type { FieldDefinition, Lookups } from "../lib/types.ts";

type View = "fields" | "preview";
type Editing = { field: FieldDefinition; originalCode?: string } | null;

export function CheckoutFieldsPage() {
  const api = useFieldsApi();
  const [view, setView] = useState<View>("fields");
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [examples, setExamples] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFields();
      setFields(data.fields);
      setExamples(data.examples);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
    api
      .lookups()
      .then(setLookups, () =>
        setLookups({ customerGroups: [], storeViews: [], unavailable: true }),
      );
  }, [api, load]);

  const enabledFields = useMemo(
    () => fields.filter((field) => field.enabled !== false),
    [fields],
  );

  const handleEdit = useCallback(
    (code: string) => {
      const field = fields.find((item) => item.code === code);
      if (field) {
        setEditing({ field: editableCopy(field), originalCode: code });
      }
    },
    [fields],
  );

  const handleCreate = useCallback((template?: FieldDefinition) => {
    setEditing({
      field: template
        ? { ...editableCopy(template), enabled: false }
        : emptyField(),
    });
  }, []);

  const handleSave = async (field: FieldDefinition, previousCode?: string) => {
    await api.saveField(field, previousCode);
    setEditing(null);
    setNotice(
      `Saved “${field.label}”. Shoppers see the change within a few minutes, once cached field definitions expire.`,
    );
    await load();
  };

  const handleDelete = async (code: string) => {
    await api.deleteField(code);
    setEditing(null);
    setNotice("Field deleted.");
    await load();
  };

  const page = style({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 24,
  });

  if (editing) {
    return (
      <div className={page}>
        <FieldEditor
          fields={enabledFields}
          initial={editing.field}
          key={editing.originalCode ?? "new"}
          lookups={lookups}
          onCancel={() => setEditing(null)}
          onDelete={handleDelete}
          onSave={handleSave}
          originalCode={editing.originalCode}
        />
      </div>
    );
  }

  return (
    <div className={page}>
      <div className={style({ display: "flex", gap: 8 })}>
        <ToggleButton
          isSelected={view === "fields"}
          onChange={() => setView("fields")}>
          Fields
        </ToggleButton>
        <ToggleButton
          isSelected={view === "preview"}
          onChange={() => setView("preview")}>
          Preview checkout
        </ToggleButton>
      </div>
      <Divider />

      {notice && (
        <InlineAlert variant="positive">
          <Heading>Done</Heading>
          <Content>
            <div
              className={style({
                alignItems: "center",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
              })}>
              <Text>{notice}</Text>
              <ActionButton isQuiet onPress={() => setNotice(null)}>
                Dismiss
              </ActionButton>
            </div>
          </Content>
        </InlineAlert>
      )}

      {view === "fields" ? (
        <FieldsList
          error={error}
          examples={examples}
          fields={fields}
          loading={loading}
          lookups={lookups}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onReload={load}
        />
      ) : (
        <main
          className={style({
            display: "flex",
            flexDirection: "column",
            gap: 16,
          })}>
          <Heading level={1} styles={style({ font: "heading-lg", margin: 0 })}>
            Preview checkout
          </Heading>
          <Text>
            The saved fields that are switched on, rendered by the storefront
            kit for a store view and customer group. Fill them in and check them
            the way Place order does.
          </Text>
          <FormPreview fields={enabledFields} lookups={lookups} />
        </main>
      )}
    </div>
  );
}
