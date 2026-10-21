UPDATE `settings`
SET
  `value` = json_set(
    `value`,
    '$.logoLight', '/brand/wordmark-light.png',
    '$.logoDark', '/brand/wordmark-dark.png'
  ),
  `revision` = `revision` + 1
WHERE `id` = 'workspace'
  AND json_extract(`value`, '$.logoLight') = '/brand/wordmark-light.svg'
  AND json_extract(`value`, '$.logoDark') = '/brand/wordmark-dark.svg';
