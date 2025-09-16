# Guía para contribuciones

- La documentación dentro de este repositorio debe escribirse en español neutro y con un tono profesional.
- Organiza el contenido en secciones con encabezados Markdown de nivel dos (`##`) y subsecciones más profundas solo si es estrictamente necesario.
- Los ejemplos de comandos deben ir en bloques de código con la etiqueta del lenguaje correspondiente.
- Para cambios exclusivamente de documentación no es obligatorio ejecutar pruebas, pero si se ejecuta una verificación de formato debe utilizarse `npm run prettier:verify`.
- Codex siempre debe ejecutar `npm test` antes de finalizar una tarea donde ha modificado código. El resto de agentes no necesitan hacerlo.

## Comandos de Salesforce CLI

### Creación de objetos, campos y pestañas

Utiliza el comando `sf schema generate` de Salesforce CLI. Ejemplos:

```bash
sf schema generate field --label "My Field"
sf schema generate sobject --label "My Object"
sf schema generate tab --object "MyObject__c" --icon 54 --directory force-app/main/default/tabs
```

[Referencia de comandos](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_schema_commands_unified.htm)

### Despliegue de metadatos

Utiliza el comando `sf project deploy start`. Ejemplos:

```bash
sf project deploy start --source-file force-app/main/default/classes/myClass.cls --verbose --json
sf project deploy start --source-dir force-app/main/default/lwc/myComponent/ --verbose --json
```

### Documentación y referencias

- Para comandos de Salesforce CLI: utiliza Context 7 con la librería `id /salesforcecli/cli`
- Para componentes y tipos de metadatos de Salesforce: utiliza Context 7
