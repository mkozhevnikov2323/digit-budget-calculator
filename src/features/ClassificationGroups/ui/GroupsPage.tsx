import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { classificationGroupsV3Enabled } from 'shared/config/classificationGroups';
import { useGroupCatalogQuery } from '../api/groupsApi';
import { displayName, type Dataset, type Group } from '../model/contract';
import { groupStatus } from './GroupSelect';
import { useMetadata, MetadataFeedback } from './Metadata';
const NameForm = ({
  group,
  busy,
  save,
  cancel,
  feedback,
}: {
  group?: Group;
  busy: boolean;
  save: (name: string) => Promise<void>;
  cancel: () => void;
  feedback: React.ReactNode;
}) => {
  const form = useForm({ defaultValues: { name: group?.name ?? '' } });
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) cancel();
      }}
      aria-labelledby="group-name-title"
    >
      <form onSubmit={form.handleSubmit((v) => save(v.name))}>
        <DialogTitle id="group-name-title">
          {group ? 'Переименовать группу' : 'Создать группу'}
        </DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            sx={{ pt: 1 }}
          >
            {feedback}
            <TextField
              label="Название группы"
              autoFocus
              disabled={busy}
              {...form.register('name', {
                validate: (v) =>
                  displayName(v) ||
                  'Название: 1–120 символов, без пробелов по краям и управляющих символов',
              })}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={cancel}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={busy}
          >
            {group ? 'Сохранить название' : 'Создать группу'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
const Groups = ({ owner }: { owner: VerifiedOwner }) => {
  const catalog = useGroupCatalogQuery(owner, {
      refetchOnMountOrArgChange: true,
    }),
    meta = useMetadata(owner);
  const [dataset, setDataset] = useState<Dataset>('expenses'),
    [filter, setFilter] = useState(''),
    [requestedPage, setPage] = useState(1),
    [editor, setEditor] = useState<{ group?: Group } | null>(null),
    [archive, setArchive] = useState<Group | null>(null);
  const data = catalog.currentData,
    ready = !!data && !catalog.isFetching && !catalog.isError,
    blocked = !ready || meta.blocked;
  const matches =
    data?.groups.filter(
      (g) =>
        g.dataset === dataset &&
        g.name.toLowerCase().includes(filter.trim().toLowerCase()),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(matches.length / 25)),
    page = Math.min(requestedPage, pages);
  const feedback = (
    <MetadataFeedback
      meta={meta}
      refresh={() => catalog.refetch().unwrap()}
    />
  );
  const patch = async (g: Group, body: Record<string, unknown>) => {
    if (!blocked)
      await meta.run({
        kind: 'group',
        method: 'PATCH',
        id: g.groupId,
        body: { expectedRevision: g.revision, ...body },
      });
  };
  const save = async (name: string) => {
    if (blocked || !editor) return;
    const g = editor.group;
    if (
      await meta.run({
        kind: 'group',
        method: g ? 'PATCH' : 'POST',
        ...(g ? { id: g.groupId } : {}),
        body: g ? { expectedRevision: g.revision, name } : { dataset, name },
      })
    )
      setEditor(null);
  };
  return (
    <Stack spacing={2}>
      <Tabs
        value={dataset}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Группы операций"
        onChange={(_e, v: Dataset) => {
          if (!meta.busy) {
            setDataset(v);
            setPage(1);
          }
        }}
      >
        <Tab
          value="expenses"
          label="Группы расходов"
        />
        <Tab
          value="incomes"
          label="Группы доходов"
        />
      </Tabs>
      {!editor && !archive && feedback}
      {catalog.isError ? (
        <Alert severity="error">
          Каталог v3 недоступен. Проверьте готовность сервера и миграцию.
        </Alert>
      ) : !ready ? (
        <Typography role="status">Загрузка всех страниц каталога…</Typography>
      ) : (
        <>
          {!data!.initialized ? (
            <Alert
              severity="info"
              action={
                <Button
                  disabled={blocked}
                  onClick={() =>
                    void meta.run({
                      kind: 'initialize',
                      method: 'POST',
                      body: {},
                    })
                  }
                >
                  Инициализировать каталог
                </Button>
              }
            >
              Каталог не инициализирован. Начальная настройка выполняется только
              по вашему нажатию.
            </Alert>
          ) : (
            <Button
              sx={{ alignSelf: 'flex-start' }}
              variant="contained"
              disabled={blocked}
              onClick={() => setEditor({})}
            >
              Создать группу
            </Button>
          )}
          <TextField
            label="Поиск группы"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
          <Typography>
            Групп: {matches.length}. Страница {page} из {pages}.
          </Typography>
          {matches.slice((page - 1) * 25, page * 25).map((g) => (
            <Box
              key={g.groupId}
              component="section"
              aria-label={`Группа ${g.name}`}
              sx={{
                border: 1,
                borderColor: 'divider',
                p: 1.5,
                borderRadius: 1,
              }}
            >
              <Stack spacing={1}>
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  {g.name}
                </Typography>
                <Stack
                  direction="row"
                  gap={1}
                  flexWrap="wrap"
                >
                  <Chip
                    size="small"
                    label={
                      g.origin === 'system' ? 'Системная' : 'Пользовательская'
                    }
                  />
                  <Chip
                    size="small"
                    label={groupStatus(g.status)}
                  />
                </Stack>
                <Stack
                  direction="row"
                  gap={1}
                  flexWrap="wrap"
                >
                  <Button
                    disabled={blocked}
                    onClick={() => setEditor({ group: g })}
                  >
                    Переименовать
                  </Button>
                  <Button
                    disabled={blocked}
                    onClick={() =>
                      void patch(g, {
                        status: g.status === 'active' ? 'disabled' : 'active',
                      })
                    }
                  >
                    {g.status === 'archived'
                      ? 'Восстановить'
                      : g.status === 'active'
                        ? 'Отключить'
                        : 'Включить'}
                  </Button>
                  {g.origin === 'system' ? (
                    <Button
                      disabled={blocked}
                      onClick={() => void patch(g, { resetName: true })}
                    >
                      Вернуть исходное название
                    </Button>
                  ) : (
                    g.status !== 'archived' && (
                      <Button
                        disabled={blocked}
                        onClick={() => setArchive(g)}
                      >
                        Архивировать
                      </Button>
                    )
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
          <Pagination
            count={pages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            aria-label="Страницы групп"
            getItemAriaLabel={(type, p, current) =>
              type === 'page'
                ? current
                  ? `Страница ${p}`
                  : `Перейти на страницу групп ${p}`
                : type === 'next'
                  ? 'Следующие группы'
                  : type === 'previous'
                    ? 'Предыдущие группы'
                    : 'Другие страницы групп'
            }
            sx={{ '& ul': { flexWrap: 'wrap' } }}
          />
          {!data!.groups.some(
            (g) =>
              g.dataset === dataset &&
              g.name.toLowerCase().includes(filter.trim().toLowerCase()),
          ) && <Typography>Группы не найдены.</Typography>}
        </>
      )}
      {catalog.isError && (
        <Button onClick={() => void catalog.refetch()}>
          Повторить загрузку каталога
        </Button>
      )}
      {editor && (
        <NameForm
          key={editor.group?.groupId ?? dataset}
          group={editor.group}
          busy={blocked}
          feedback={feedback}
          save={save}
          cancel={() => {
            if (!meta.busy) setEditor(null);
          }}
        />
      )}
      <Dialog
        open={!!archive}
        onClose={() => {
          if (!meta.busy) setArchive(null);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="archive-group-title"
      >
        <DialogTitle id="archive-group-title">Архивировать группу?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>{archive?.name}</Typography>
            <Typography>
              Исторические назначения сохранятся. Группа станет недоступной для
              новых назначений и правил.
            </Typography>
            {feedback}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={meta.busy}
            onClick={() => setArchive(null)}
          >
            Отмена
          </Button>
          <Button
            disabled={blocked}
            onClick={async () => {
              if (
                archive &&
                (await meta.run({
                  kind: 'group',
                  method: 'DELETE',
                  id: archive.groupId,
                  body: { expectedRevision: archive.revision },
                }))
              )
                setArchive(null);
            }}
          >
            Архивировать группу
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
export default function GroupsPage() {
  const owner = useVerifiedOwner();
  return (
    <Box p={{ xs: 1, sm: 3 }}>
      <Stack spacing={2}>
        <Typography
          component="h1"
          variant="h5"
        >
          Управление группами доходов и расходов
        </Typography>
        <Button
          component={Link}
          to="/profile"
        >
          Вернуться в профиль
        </Button>
        {!classificationGroupsV3Enabled ? (
          <Alert severity="info">
            Пользовательские группы v3 пока выключены. Настройки не изменены.
          </Alert>
        ) : owner.status !== 'verified' ? (
          <Alert severity="info">Нужна текущая проверка владельца.</Alert>
        ) : (
          <Groups
            key={`${owner.owner.userId}/${owner.owner.sessionGeneration}`}
            owner={owner.owner}
          />
        )}
      </Stack>
    </Box>
  );
}
