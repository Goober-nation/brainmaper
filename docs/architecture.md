# Архитектура и API

Браузер обращается к Nginx, который отдает сборку React и перенаправляет `/api/` на Go backend. Backend читает и записывает карты в MongoDB, сохраняет файлы в `/app/data/admin/<map-id>/` и обращается к Gemini при запросе ответа. Модель получает тему карты, исходный материал и цепочку предков выбранного узла. При нескольких входящих связях код выбирает одного родителя.

## HTTP API

Все тела POST - JSON.

- `GET /api/maps` - список карт.
- `POST /api/maps` - создать карту: `title`, `core_material`.
- `GET /api/maps/{id}` - узлы и связи карты.
- `DELETE /api/maps/{id}` - удалить карту.
- `POST /api/maps/{id}/ask` - вопрос: `question`, `parent_node_id`, `pos_x`, `pos_y`, необязательные `media_base64` и `media_name`. Вложение передается как data URL. Для генерации требуется Gemini.
- `POST /api/maps/{id}/nodes/{node}/state` - положение, размер и сворачивание: `x`, `y`, `width`, `height`, `is_collapsed`.
- `DELETE /api/maps/{id}/nodes/{node}` - удалить узел и его связи.
- `POST /api/maps/{id}/joiner` - создать соединительный узел с `pos_x` и `pos_y`.
- `POST /api/edges` - создать связь: `map_id`, `source_node_id`, `target_node_id`.
- `DELETE /api/maps/{id}/edges/{edge}` - удалить связь.
- `GET /api/media/admin/{map}/{file}` - получить сохраненное вложение.

Ограничения: файлы и карты не разделены по пользователям; запросы и данные следует размещать только в доверенной среде. Удаление карты не удаляет ее файлы из каталога вложений. Генерация зависит от внешнего API; автономных ответов приложение не выдает.
