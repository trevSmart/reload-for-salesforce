# Reload for Salesforce

Reload for Salesforce és una Lightning App empaquetable que centralitza la configuració i l'execució de càrregues de dades amb un enfocament flexible i dinàmic. El framework combina una taula intermèdia universal amb eines de mapping perquè les organitzacions puguin portar dades cap a qualsevol objecte estàndard o personalitzat sense reconfigurar l'esquema cada vegada.

## Funcionalitats clau

- **Aplicació Lightning dedicada**: l'app "Reload for Salesforce" agrupa pestanyes i una pàgina d'inici amb el component `Reload Workbench` per guiar l'usuari a través de tot el procés.
- **Taula intermèdia universal**: els objectes `Reload Data Batch`, `Reload Staging Record` i `Reload Field Value` emmagatzemen qualsevol payload mitjançant relacions mestre-detall i informació complementària (estat, origen, errors, etc.).
- **Interfície interactiva**: el component LWC mostra lots recents, registres estagiats i detalls de camps sense que l'usuari hagi d'editar JSON a mà.
- **Permission Set administrat**: el permission set `Reload Admin` concedeix l'accés necessari a l'aplicació, als objectes i al controlador Apex.

## Model de dades

| Objecte | Descripció | Camps destacats |
| --- | --- | --- |
| `Reload_Batch__c` | Agrupa la càrrega en lots i desa el context de l'origen i l'estat global. | Target Object API, Default Operation, Source Type, comptadors i notes |
| `Reload_Staging__c` | Registre intermig amb payload dinàmic i metadades de processament. | Batch, Status, Record Action, Payload, Error Message |
| `Reload_Field_Value__c` | Parell camp-valor vinculat a cada registre estagiat per editar-lo fàcilment. | Field API Name, Field Type, Field Value, Is Key |

## Components i metadades incloses

- Lightning App `Reload for Salesforce` i pestanyes de navegació (Lots, Registres, Valors, Reload Manager).
- Lightning App Page `Reload Manager` amb el component `Reload Workbench`.
- Controlador Apex `ReloadWorkspaceController` i test unitari corresponent.
- Permission Set `Reload Admin` amb permisos d'objecte i de camp.
- Layouts, llistes i compact layouts personalitzats per a cada objecte.

## Desplegament

1. Autentica't a l'org destinació (per exemple, un sandbox):

   ```bash
   sfdx auth:web:login --setalias reload-dev --instanceurl https://test.salesforce.com
   ```

2. Desplega el codi al teu entorn:

   ```bash
   sfdx deploy source --sourcepath force-app --target-org reload-dev
   ```

3. Assigna el permission set a l'usuari que hagi de gestionar càrregues:

   ```bash
   sfdx force:user:permset:assign --permsetname Reload_Admin --targetusername <usuari>
   ```

4. Accedeix a l'aplicació Lightning "Reload for Salesforce" i comença a preparar lots de dades.

## Tests

Executa el test unitari inclòs per validar el controlador i obtenir cobertura:

```bash
sfdx force:apex:test:run --tests ReloadWorkspaceControllerTest --wait 10 --resultformat human --targetusername reload-dev
```

---

Aquest repositori segueix l'estructura estàndard de Salesforce DX i es pot empaquetar com a (Managed) Package o distribuir-se mitjançant Change Sets segons convingui.
