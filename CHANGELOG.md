# Changelog

## [2.7.1](https://github.com/huishouden/tasks/compare/v2.7.0...v2.7.1) (2026-10-05)

### Bug Fixes

* a change saved just before the app closed and written again when it next opens never puts back an older value; another member's newer change is kept (pwa-kit 0.102.0)

## [2.7.0](https://github.com/huishouden/tasks/compare/v2.6.0...v2.7.0) (2026-10-05)

### Features

* hashed assets from the suite's asset CDN (pwa-kit 0.100.0) ([5755c0b](https://github.com/huishouden/tasks/commit/5755c0b14b0e42f5a89f4e066c24fd2da68a452c))

## [2.6.0](https://github.com/huishouden/tasks/compare/v2.5.4...v2.6.0) (2026-10-05)

### Features

* **reminders:** each item reminder names its item, so ticking it elsewhere stops it ([f01ac4a](https://github.com/huishouden/tasks/commit/f01ac4a27770d094b1d3706a3f198cf2a0f2a2a9))

### Bug Fixes

* **e2e:** honour hh's emulator ports (HH_EMULATOR_*, VITE_EMULATOR_*) ([1e26560](https://github.com/huishouden/tasks/commit/1e265608cec2188b750f1c5dd539b0f151200f04))

### Other

* docs, review: reminders that stop once done elsewhere ([3a7ded6](https://github.com/huishouden/tasks/commit/3a7ded64211ecd685fd360424b2116f4be1c623f))

## [2.5.4](https://github.com/huishouden/tasks/compare/v2.5.3...v2.5.4) (2026-10-05)

### Tests

* signed-in tests on a household of the run's own; all but the portal To-do round trip run on the kit's emulators (`bun run e2e:emulator`), and an emulator build takes their project and host ([#71](https://github.com/huishouden/tasks/issues/71))

## [2.5.3](https://github.com/huishouden/tasks/compare/v2.5.2...v2.5.3) (2026-10-05)

### Other

* Maintenance

## [2.5.2](https://github.com/huishouden/tasks/compare/v2.5.1...v2.5.2) (2026-10-05)


### Bug Fixes

* **todos:** the portal's to-do button says what it does, "Mark done" not "Done" ([#80](https://github.com/huishouden/tasks/issues/80)) ([69fdf54](https://github.com/huishouden/tasks/commit/69fdf5468724e2f2f6ae8a770aa1ca9355ac663a))

## [2.5.1](https://github.com/huishouden/tasks/compare/v2.5.0...v2.5.1) (2026-10-05)


### Bug Fixes

* **items:** done items read as done, not faded; kit 0.86.0 ([#76](https://github.com/huishouden/tasks/issues/76)) ([e8e4802](https://github.com/huishouden/tasks/commit/e8e480226c7ec772bf323083be05a4c06591e10d))

## [2.5.0](https://github.com/huishouden/tasks/compare/v2.4.1...v2.5.0) (2026-10-05)


### Features

* **nearby:** Find nearby searches near the household's home without location ([#73](https://github.com/huishouden/tasks/issues/73)) ([fc33360](https://github.com/huishouden/tasks/commit/fc333605c8bb65b690428f2af4a7ee58bfe2a7f6))


### Bug Fixes

* **nearby:** link "set the household's home" to the portal's Apps tab ([#75](https://github.com/huishouden/tasks/issues/75)) ([0324197](https://github.com/huishouden/tasks/commit/0324197ba8b7af59cd659e14ff1d2c7622a071f9))

## [2.4.1](https://github.com/huishouden/tasks/compare/v2.4.0...v2.4.1) (2026-10-04)


### Bug Fixes

* Theme lives in the app bar's menu only; Settings drop their copy ([#68](https://github.com/huishouden/tasks/issues/68)) ([f6710b8](https://github.com/huishouden/tasks/commit/f6710b8a6181f390905f64b38efc95d59aa3678f))

## [2.4.0](https://github.com/huishouden/tasks/compare/v2.3.0...v2.4.0) (2026-10-04)


### Features

* dated items in your own calendar: Add to calendar on every dated item, and changes made in Google Calendar come back ([#64](https://github.com/huishouden/tasks/issues/64)) ([0c0c97a](https://github.com/huishouden/tasks/commit/0c0c97a6a00d66d04383e21614dd734af255bed6))


### Bug Fixes

* Tasks settings in the app bar's menu, one button signed out; kit 0.70.0 ([#67](https://github.com/huishouden/tasks/issues/67)) ([466021e](https://github.com/huishouden/tasks/commit/466021e98663ab512e35c904622def0998af302d))

## [2.3.0](https://github.com/huishouden/tasks/compare/v2.2.1...v2.3.0) (2026-10-04)


### Features

* Tasks in Spanish and Dutch ([#62](https://github.com/huishouden/tasks/issues/62)) ([15c1807](https://github.com/huishouden/tasks/commit/15c180705b75ed775f6c6a4e00765f61ce805f8d))

## [2.2.1](https://github.com/huishouden/tasks/compare/v2.2.0...v2.2.1) (2026-10-03)


### Bug Fixes

* name the gear "Tasks settings", like the other apps ([#60](https://github.com/huishouden/tasks/issues/60)) ([340a068](https://github.com/huishouden/tasks/commit/340a068068acc67e05634fe9a841ae3e997c316c))

## [2.2.0](https://github.com/huishouden/tasks/compare/v2.1.0...v2.2.0) (2026-10-03)


### Features

* dark mode that follows the suite's theme ([#58](https://github.com/huishouden/tasks/issues/58)) ([4298950](https://github.com/huishouden/tasks/commit/42989500d090d6389f572ead5dc3d95635089d87))

## [2.1.0](https://github.com/huishouden/tasks/compare/v2.0.0...v2.1.0) (2026-10-03)


### Features

* publish open to-dos to the household to-do list, and cancel a task ([#55](https://github.com/huishouden/tasks/issues/55)) ([e8ad44a](https://github.com/huishouden/tasks/commit/e8ad44a92617e0f479feaeccd27a4ce3ee372da9))

## [2.0.0](https://github.com/huishouden/tasks/compare/v1.11.1...v2.0.0) (2026-10-03)


### ⚠ BREAKING CHANGES

* Store, Meals and Kitchen, and shopping lists, are in Huishouden Groceries.

### Features

* Tasks is to-dos and chores; shopping lists, stores and meals move to Huishouden Groceries ([#52](https://github.com/huishouden/tasks/issues/52)) ([79d96fb](https://github.com/huishouden/tasks/commit/79d96fb21bbc76d5a2539b2e80f4d41ab7d1600d))

## [1.11.1](https://github.com/huishouden/tasks/compare/v1.11.0...v1.11.1) (2026-10-03)


### Bug Fixes

* dialogs keep focus where it was tapped on phones (pwa-kit 0.51.0) ([#51](https://github.com/huishouden/tasks/issues/51)) ([030f9a7](https://github.com/huishouden/tasks/commit/030f9a7934fef2ef4216bf5aa5c1689a9af35f89))

## [1.11.0](https://github.com/huishouden/tasks/compare/v1.10.0...v1.11.0) (2026-10-03)


### Features

* Tasks moves to /tasks/ on the suite's one site (pwa-kit 0.48.0) ([#49](https://github.com/huishouden/tasks/issues/49)) ([b054169](https://github.com/huishouden/tasks/commit/b054169e9bb26b85808bd1b36e34e23d0943d38c))

## [1.10.0](https://github.com/huishouden/tasks/compare/v1.9.0...v1.10.0) (2026-10-03)


### Features

* **security:** security headers; one-line Sample data banner on phones ([#44](https://github.com/huishouden/tasks/issues/44)) ([dcc9b7b](https://github.com/huishouden/tasks/commit/dcc9b7bcdf2c2b12239655b6ad48f30656b233cd))

## [1.9.0](https://github.com/huishouden/tasks/compare/v1.8.0...v1.9.0) (2026-10-03)


### Features

* find an item at the store's own website search, and section headings that stay in view ([#46](https://github.com/huishouden/tasks/issues/46)) ([51fb018](https://github.com/huishouden/tasks/commit/51fb018b1b9021eded2a6b593e1670d1213228aa))

## [1.8.0](https://github.com/huishouden/tasks/compare/v1.7.0...v1.8.0) (2026-10-02)


### Features

* **roles:** helpers and kids tick anyone's items and change only their own; settings for admins and members ([#42](https://github.com/huishouden/tasks/issues/42)) ([48b030a](https://github.com/huishouden/tasks/commit/48b030ab7ed3ebdd75be054ce0409d6d090b56e5))

## [1.7.0](https://github.com/huishouden/tasks/compare/v1.6.0...v1.7.0) (2026-10-02)


### Features

* what you tell an assistant to add reaches the household's lists (Google Tasks) ([#38](https://github.com/huishouden/tasks/issues/38)) ([775a112](https://github.com/huishouden/tasks/commit/775a112f545ceb01af330681a47bf7d39b358dc4))

## [1.6.0](https://github.com/huishouden/tasks/compare/v1.5.0...v1.6.0) (2026-10-02)


### Features

* Lists opens on what needs doing today ([#37](https://github.com/huishouden/tasks/issues/37)) ([c4d472d](https://github.com/huishouden/tasks/commit/c4d472dd6f421b6eb528b0d630cf7cdf5cde473a))

## [1.5.0](https://github.com/huishouden/tasks/compare/v1.4.0...v1.5.0) (2026-10-02)


### Features

* signed out, Tasks opens on an invented household to try ([#34](https://github.com/huishouden/tasks/issues/34)) ([2bb7012](https://github.com/huishouden/tasks/commit/2bb7012becd8df69636e5d25765a784c4cee0f61))

## [1.4.0](https://github.com/huishouden/tasks/compare/v1.3.0...v1.4.0) (2026-10-02)


### Features

* error, speed and anonymous usage reports (pwa-kit observability) ([#26](https://github.com/huishouden/tasks/issues/26)) ([317817d](https://github.com/huishouden/tasks/commit/317817dd07c08259a541298b91675c5bc27df765))
* meal ideas stay within the household's mildest spice tolerance ([#30](https://github.com/huishouden/tasks/issues/30)) ([b2a76aa](https://github.com/huishouden/tasks/commit/b2a76aa965cbcafa8edebe71459f695df96cec56))

## [1.3.0](https://github.com/huishouden/tasks/compare/v1.2.1...v1.3.0) (2026-10-02)


### Features

* dated tasks on the household calendar, with push reminders ([#29](https://github.com/huishouden/tasks/issues/29)) ([5c48bea](https://github.com/huishouden/tasks/commit/5c48beaa672c2c189bc0bf0af31a9eb8fa7d09bd))

## [1.2.1](https://github.com/huishouden/tasks/compare/v1.2.0...v1.2.1) (2026-10-02)


### Bug Fixes

* an entry saved just before the app closes is no longer lost ([#25](https://github.com/huishouden/tasks/issues/25)) ([cc934fb](https://github.com/huishouden/tasks/commit/cc934fb7e7bac99cc0fdd503199d73b5e6dd334f))

## [1.2.0](https://github.com/huishouden/tasks/compare/v1.1.0...v1.2.0) (2026-10-02)


### Features

* Tasks opens in the Huishouden app bar, on the shared kit's sign-in, calendar and link previews ([#27](https://github.com/huishouden/tasks/issues/27)) ([d120196](https://github.com/huishouden/tasks/commit/d120196176fdeb932d711e5997db3b8136e2786a))

## [1.1.0](https://github.com/huishouden/tasks/compare/v1.0.0...v1.1.0) (2026-10-02)


### Features

* Find nearby shows hours, warns when closed, and hands off to Google Maps ([#21](https://github.com/huishouden/tasks/issues/21)) ([aa916b7](https://github.com/huishouden/tasks/commit/aa916b772c28dac2542c6ae6f27c48541f253b0f))
* meal ideas plan from the list, suggest extras, and follow the household's diets ([#22](https://github.com/huishouden/tasks/issues/22)) ([ac13949](https://github.com/huishouden/tasks/commit/ac13949a602414dd99c5d40d2dae9f55e0236dc4))
* plan meal ideas into a shared week ([#23](https://github.com/huishouden/tasks/issues/23)) ([db65559](https://github.com/huishouden/tasks/commit/db655599ebf747a3e23d66e74f3224dfe5dc9774))
* task details fit the task: typed times, nearby places, fewer fields ([#17](https://github.com/huishouden/tasks/issues/17)) ([2ac4a4d](https://github.com/huishouden/tasks/commit/2ac4a4de35014e57a08c1d82950fae31ee4b1549))


### Bug Fixes

* dates typed into a task become its due date ([#24](https://github.com/huishouden/tasks/issues/24)) ([b1ad460](https://github.com/huishouden/tasks/commit/b1ad460f7809a41c2776cd9a5f5d853e78643494))

## 1.0.0 (2026-10-02)


### ⚠ BREAKING CHANGES

* become Huishouden Tasks on the shared Huishouden kit ([#6](https://github.com/huishouden/tasks/issues/6))

### Features

* become Huishouden Tasks on the shared Huishouden kit ([#6](https://github.com/huishouden/tasks/issues/6)) ([aeba96e](https://github.com/huishouden/tasks/commit/aeba96e5d1d7c33069529604dc76bfab455a9970))
* Find in my calendar on tasks; fix the store layout editor on phones ([#1](https://github.com/huishouden/tasks/issues/1)) ([868c7a8](https://github.com/huishouden/tasks/commit/868c7a8e3fea3c6ca3082571491fd4f97251f5fa))
* learn aisles while shopping, from a detected store ([#2](https://github.com/huishouden/tasks/issues/2)) ([90b68a6](https://github.com/huishouden/tasks/commit/90b68a6f681287a7b24d5beeac026b618f43e1bd))


### Bug Fixes

* close the learned-aisles rules test so CI can deploy the rules ([#4](https://github.com/huishouden/tasks/issues/4)) ([4931362](https://github.com/huishouden/tasks/commit/4931362f20c3f8712ffaed02c758273c1bf34bf9))
* Done shopping restarted the trip while still at the store ([#8](https://github.com/huishouden/tasks/issues/8)) ([04c914d](https://github.com/huishouden/tasks/commit/04c914d6b8badd8dcbb4ff0e35b8ef9d9510e02f))
