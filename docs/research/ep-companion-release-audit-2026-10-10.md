# Аудит конкурентов EP: Cornerman, PunchKit, Best Friend
Дата проверки: 2026-10-10. Источники: официальные страницы разработчиков, руководства и публичная история App Store/Google Play. Это **обзор заявленных возможностей**, не независимое HIL-тестирование чужих приложений. Код и ассеты конкурентов не анализировались и не копировались.

## Срез последних публично найденных релизов
- Cornerman CM-133: iOS 1.0.2 (21.05.2025), Android публикация обновлена 21.05.2025. Последующих опубликованных версий в проверенной истории не найдено.
- PunchKit: 1.10 (App Store, 10.09.2026). Официальная веб-страница /whats-new подробно покрывает 1.0–1.8; для 1.9–1.10 использован App Store.
- Best Friend for K.O. II: 3.2 (App Store, проверено 10.10.2026). История включает 1.0, 2.0–2.8 и 3.0–3.2; достоверного отдельного описания версии 2.9 не найдено.

## Полная доступная история изменений

### Cornerman (Drum Machine Funk)
| Релиз | Доступное публичное описание |
| --- | --- |
| 1.0, 07.11.2024 | USB-C библиотека резервных копий EP-133: создать, восстановить, организовать, поделиться. |
| 1.0.1, 10.11.2024 | Исправления ошибок и производительности. |
| 1.0.2, 21.05.2025 | Обновлён механизм передачи для firmware 2.0 и справочник/шорткаты, исправления. |

Важно: Cornerman не заявляет сэмпл-редактор, kit builder или экспорт стемов; «Sample Librarian» в данном случае в основном backup/restore. PDF-руководство описывает подключение USB-C и требования к питанию от телефона. Имеется встроенный офлайновый справочник по пользовательским отзывам, но подробная история его изменения не опубликована. iOS страница указывает In-App Purchase для backup/restore.

### PunchKit (Kristaps Dreija)
| Релиз | Появившиеся функции |
| --- | --- |
| 1.0, 07.2026 | EP-133/1320/40 по USB; проекты/группы/пэды/библиотека; import/preview/trim/processing/placement; запись USB-аудио WAV/M4A, voice-trigger; версии обработанных тейков; fx; backup bank/project/device; темы. |
| 1.1 | Автообнаружение устройств; устойчивость USB recording, статус аудиовхода и разрешений, haptics, UI. |
| 1.2 | Доработка reconnect/автоподключения, разрешений микрофона, стабильности записи, интерфейса. |
| 1.3 | Офлайн 12-pad Kit Builder с импортом/экспортом; локальное AI-разделение тейка на 4 дорожки после опциональной загрузки модели, stem mixer; live эффекты с XY, версии takes. |
| 1.4 | Запись через всю FX-chain; виртуальная кассета/scratch и синхронизация; быстрое переключение эффектов; drag reassignment пэдов; batch deletion с подтверждениями; preflight памяти/прогресса. |
| 1.5 | Pixel Background Studio (визуальные фоны); поиск, сортировка, фильтры тейков; настройка scratch; живой BPM; экран What's New; улучшение diagnostics. |
| 1.6 | Beat-synced cassette looper ½–8 тактов; Space FX (Reverb/Dub/Granulator/etc.); единая локальная Sample Shelf между разделами, offline backups; улучшения audio-routing. |
| 1.7 | MIDI Playground с Chord/Melody/Bass machines, arpeggios и lock к MIDI clock; upload целой папки с подкаталогами, очередью, предварительным расчётом конвертированного размера и skip free/overwrite. |
| 1.8 | Сохранение работающих MIDI machines при переходах; ALL OFF (все MIDI каналы); верхний/нижний регистр аккордов; USB-input monitoring через динамик iPhone/iPad при отсутствии свободной USB return. |
| 1.9 | Отдельные RECORD INPUT (MAIN/CH1/CH2/AUX и т.д.) и PLAYBACK+MONITOR, снижение feedback risk; адаптивный читаемый Mac UI. |
| 1.10 | Восстановление пользовательского TE .pak с preflight: модель, 9 проектов, WAV, защищённые слоты, память, список переписанных/удалённых объектов, подтверждение OVERWRITE для factory PAK; точные исходные слоты; .ppak исключён; улучшения macOS layout. |

### Best Friend for K.O. II (Brian Holt)
| Релиз | Доступное публичное описание |
| --- | --- |
| 1.0 / 2.0, 02.07.2026 | Ранние версии; раздельных детальных changelog для этих двух номеров не найдено, не реконструировать. |
| 2.1, 07.07 | Bank Snapshots, массовые move/delete/share, waveform zoom/pan, поддержка firmware 2.5 (USB preview, 40s mono, fidelity, reverse), reconnect/cache improvements. |
| 2.2, 12.07 | Multi-samples EP-1320/EP-40, Supertone/loop support, sharing .epbank, swipe/long press, accessibility; fixes. |
| 2.3, 19.07 | Из списка сэмплов назначение на активный пэд долгим нажатием; улучшение waveform/cycle и performance. |
| 2.4, 21.07 | Project/System backup и restore, импорт сторонних бэкапов; .epbank как архив с WAV/конфигурацией; transfer fixes. |
| 2.5, 01.08 | В публичном тексте в основном суммируются изменения 2.3–2.4, отдельные уникальные функции надёжно не отделяются. |
| 2.6, 09.08 | AI Stem Splitter на drums/bass/vocals/guitar/others; непрерывное preview во время смены параметров, багфиксы. |
| 2.7, 17.08 | Темы по типам устройств; iPad/Mac/landscape, per-pad mute/pitch/reverse, drag pads between groups, reorder snapshots, drag files, skip single failed file in batch, preferences. |
| 2.8, 24.08 | В основном стабилизация drag/drop, sample naming, storage location, визуальный pad feedback. |
| 3.0, 04.09 | MIDI chord builder/pitch/modulation/velocity, clock-synced arpeggiator с 4 режимами, octaver, navigation shortcuts. |
| 3.1, 22–25.09 (региональные даты) | Scenes/Song timeline, fader automation; per-pad/group/stereo bounce и MIDI export из проекта (не AI); backup preview/extract, иерархическая library/iCloud, key detection, chord presets/zones и онбординг. |
| 3.2, версия видна в App Store к 10.10.2026 | Offline Library (Kits, Snapshots, backup import and bounce без EP), MIDI file import/map/record, offline editing snapshots, улучшения scene/fader/bounce, duplicate slot, previews/зум и устранение ошибок с pitch bend, Supertone, legato, мультисэмплами. В части регионов 3.2/3.1 отображается со сдвигом даты. |

Отдельного достоверного changelog **2.9** и выпусков **1.1–1.x** Best Friend не найдено. Некоторые региональные листинги и сайт имеют не синхронные описания; для последних функций приоритет отдан наиболее свежему App Store и тематическим docs разработчика.

## Важное техническое различие stem
1. **AI Stem Split**: извлекает предполагаемые инструменты из единственного готового аудио; не гарантирует точного результата (PunchKit 1.3, Best Friend 2.6).
2. **Project bounce to per-pad stems**: воспроизводит sequencer events и PCM-образцы из проектных данных/архива, экспортирует по пэдам/группам и MIDI (Best Friend 3.1). Это требует точной поддержки pitch, ADSR, mute/legato, fader automation, scene chaining, временны́х параметров и семплированных форматов; FX fidelity следует отдельно оговаривать. Supertone на EP-40 не является доступным WAV и не должен ошибочно обещаться в рендере.

## Что уже есть в Speeduppercut OS / My EP (проверено по репозиторию 2026-10-10)
- `/os/`: Samples позволяет локально импортировать аудио, использовать настоящий WAV processing/waveform, mono/stereo, fidelity, Space Saver x2, preview/download. Сам этот workspace **не** посылает WAV непосредственно в EP.
- Встроенный persistent My EP: работа с живыми sample slots, search, предварительным прослушиванием, rename, подтверждёнными uploads/moves/deletes, проекты/зависимости, backup/restore и recovery. Операции идут через старый защищённый runtime, а не новую реализацию SysEx.
- `os/sequencerSketch.js`: **демонстрационный локальный паттерн**, НЕ реальные данные EP; существующий проверенный `projectSequencer.js` находится в My EP.
- Live read-only device session status и firmware после подтверждённой идентичности. Изменение темы/компоновки не меняет MIDI ownership.
- E2E fake device не эквивалент HIL на EP-133/EP-1320/EP-40.

## Приоритизация: перенимать идею и UX, не чужой код/дизайн
| Приоритет | Возможность | Рекомендуемый первый проверяемый шаг | Условия |
| --- | --- | --- | --- |
| P0 | Shared offline sample library/kit builder (PunchKit 1.3/1.6, BF 3.2) | 12-pad черновики и sample shelf с импортом, предпрослушиванием, drag/drop, версионированием; никаких MIDI-записей | локальное хранилище, формат переносимого проекта |
| P0 | Batch upload preflight (PunchKit 1.7/1.10) | очередь папок + per-file size before/after, free slot vs overwrite и guarded approval | только существующий My EP transaction/runtime; verify/recovery |
| P0 | Offline backup library (Cornerman/BF) | индекс локальных архивов + имена, даты, превью метаданных, import/export без подключения | не переписывать .pak/.ppak без валидированного parser |
| P1 | Bank Snapshot (BF 2.1) | read-only снимок 12 pad assignments + referenced WAV; тест корректности project dependencies | restore только после capability/HIL |
| P1 | Read-only Scenes timeline (BF 3.1) | декодировать эталонные проектные fixtures, показать note grid/scene chain и fader lanes, отмечать неизвестное | provenance каждого события, нулевые device writes |
| P1 | Project/backup preview/export MIDI | экспорт подтверждённых событий в Standard MIDI File с явным mapping | timing, velocity, MIDI channel, pitch bend test fixtures |
| P2 | Offline per-pad bounce (BF 3.1/3.2) | спроектировать ref renderer и сравнить c эталонными записями/fixtures | legato, automation, FX, multisample, Supertone; не обещать exact |
| P2 | Audio FX editor, auto key detection, AI stems | сначала независимые offline effect chains; AI через лицензированную модель и opt-in загрузку | CPU, RAM, лицензии, качество, безопасность WAV |
| P2 | External MIDI chord/arp | только отдельный явный MIDI-режим с panic/ALL OFF и clock sync | без пересечения владельца файловых операций |
| Отложить | USB audio recorder/looper/cassette, Pixel Background | отдельное исследование доступности платформенных audio endpoints | USB routing, loopback/feedback, нужен не только WebMIDI |

### Engineering contract на следующую реализацию
- **Сначала read-only preview** и достоверный детерминированный preflight, затем изменения устройства в существующем My EP.
- Не переписывать protocol/MIDI/SysEx/device ownership по материалам конкурентов.
- Всегда учитывать model/firmware, protected slots, memory delta, replacement impact, подтверждение overwrite, возможность recovery.
- Проверять EP-133 и особенности EP-1320 / EP-40 (multi-samples, Supertone) отдельно.
- Новые навигационные страницы не плодить: Samples содержит библиотеку, редактор, converter, kit и UX подготовки/очереди Sample Transfer; фактическое безопасное выполнение переноса и backup/recovery остаётся внутри My EP в Device; Projects содержит scenes/sequencer и импорт проектов.
- Любая заявленная hardware-функция получает proof by fake-device tests + отдельно реальный HIL.
- UI концепции можно переосмыслить, но нельзя копировать чужие фирменные assets, код или claim независимого софта как официального TE.

## Первоисточники
- Cornerman App Store: https://apps.apple.com/us/app/cornerman-for-k-o-ii/id6499280264
- Cornerman Google Play: https://play.google.com/store/apps/details?id=com.drummachinefunk.cornerman
- Cornerman manual: https://drummachinefunk.com/files/Cornerman_User_Manual.pdf
- PunchKit developer release log v1.0–1.8: https://punchkit.dev/whats-new
- PunchKit App Store v1.9–1.10: https://apps.apple.com/us/app/punchkit/id6785249847
- Best Friend App Store version history: https://apps.apple.com/sr/app/best-friend-for-k-o-ii/id6782250723
- Best Friend official overview: https://epbf.app/
- Best Friend documentation index: https://epbf.app/docs
- Scene timeline details: https://epbf.app/docs/see-scenes-and-songs
- Per-pad bounce and known Supertone exclusion: https://epbf.app/docs/bounce-stems-to-your-daw
- Offline bounce from backup: https://epbf.app/docs/bounce-from-a-backup
- Bank snapshots: https://epbf.app/docs/bank-snapshots
