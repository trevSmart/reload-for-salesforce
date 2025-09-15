# Reload for Salesforce

## Introducción
Reload for Salesforce es una aplicación Lightning empaquetable que centraliza la configuración y ejecución de cargas de datos con un enfoque flexible y visual. La solución combina una tabla intermedia universal con herramientas de mapeo para que los equipos puedan llevar información a cualquier objeto estándar o personalizado sin reconfigurar el esquema en cada iteración.

## Características principales
- **Aplicación Lightning dedicada**: la app agrupa pestañas de trabajo y una página de inicio con el componente `Reload Workbench` para guiar a los usuarios durante todo el proceso de carga.
- **Tabla intermedia universal**: los objetos `Reload Data Batch`, `Reload Staging Record` y `Reload Field Value` almacenan cualquier payload mediante relaciones maestro-detalle y metadatos complementarios (estado, origen, errores, entre otros).
- **Interfaz interactiva**: el componente LWC muestra lotes recientes, registros en staging y detalle de campos sin que sea necesario editar JSON manualmente.
- **Permission Set administrado**: el permission set `Reload Admin` garantiza el acceso a la app, a los objetos personalizados y al controlador Apex.

## Arquitectura de datos
| Objeto | Descripción | Campos destacados |
| --- | --- | --- |
| `Reload_Batch__c` | Agrupa la carga en lotes y guarda el contexto del origen junto con el estado global. | Target Object API, Default Operation, Source Type, contadores y notas |
| `Reload_Staging__c` | Registra los datos intermedios con payload dinámico y metadatos de procesamiento. | Batch, Status, Record Action, Payload, Error Message |
| `Reload_Field_Value__c` | Relaciona cada registro intermedio con pares campo-valor para su edición. | Field API Name, Field Type, Field Value, Is Key |

## Componentes incluidos
- Lightning App `Reload for Salesforce` con pestañas de navegación (Lotes, Registros, Valores y Reload Manager).
- Lightning App Page `Reload Manager` con el componente `Reload Workbench` como panel central.
- Controlador Apex `ReloadWorkspaceController` acompañado de su clase de pruebas.
- Permission Set `Reload Admin` con permisos de objeto y campo configurados.
- Layouts, listas relacionadas y compact layouts adaptados a cada objeto.

## Requisitos previos
- CLI de Salesforce (SFDX) instalada y autenticada en la organización de destino.
- Perfil con permisos para desplegar metadatos y asignar permission sets.
- Node.js 18+ si se desea ejecutar pruebas unitarias o linting de componentes LWC.

## Puesta en marcha rápida
1. Autentica la organización de destino (por ejemplo, un sandbox):
   ```bash
   sfdx auth:web:login --setalias reload-dev --instanceurl https://test.salesforce.com
   ```
2. Despliega el código y la configuración de la app:
   ```bash
   sfdx deploy source --sourcepath force-app --target-org reload-dev
   ```
3. Asigna el permission set al usuario que operará Reload:
   ```bash
   sfdx force:user:permset:assign --permsetname Reload_Admin --targetusername <usuario>
   ```
4. Accede a la aplicación Lightning "Reload for Salesforce" para revisar lotes recientes, registros en staging y métricas del proceso.

## Ejecución de pruebas
Ejecuta el test unitario incluido para validar el controlador y asegurar cobertura antes de desplegar a producción:
```bash
sfdx force:apex:test:run --tests ReloadWorkspaceControllerTest --wait 10 --resultformat human --targetusername reload-dev
```

## Personalización y operación
- Define tus fuentes de datos y reglas de transformación creando lotes (`Reload_Batch__c`) y registros de staging (`Reload_Staging__c`).
- Usa los pares campo-valor (`Reload_Field_Value__c`) para validar y ajustar la información antes de confirmar la inserción o actualización en Salesforce.
- Monitorea el progreso desde la app page `Reload Manager`, que expone métricas clave y atajos para resolver errores.

## Estructura del repositorio
- `force-app/` contiene los metadatos de la aplicación, incluyendo objetos personalizados, componentes LWC y clases Apex.
- `config/` y `manifest/` incluyen archivos auxiliares para despliegue con SFDX.
- `sfdx-project.json` define los paquetes y paths utilizados por Salesforce DX.
- Archivos de configuración como `package.json`, `eslint.config.js` y `prettier` scripts permiten aplicar buenas prácticas en el código fuente.

## Recursos y soporte
- Documentación oficial de Salesforce DX: <https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm>
- Tutoriales Lightning Web Components: <https://developer.salesforce.com/docs/component-library/documentation/en/lwc>
- Para soporte interno, documenta procesos y decisiones en este repositorio para mantener una trazabilidad clara del framework.
