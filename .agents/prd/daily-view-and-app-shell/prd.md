PRD ID: PRD-daily-view-and-app-shell

# Daily View and App Shell

## Problem Statement

La app actual de libt tiene la vista diaria como experiencia principal, pero esa sección creció sobre una base frágil: mezcla modelo, UI, queries, estado local, drag and drop, calendario y sincronización en componentes grandes. Además, el scroll diario actual tiende a retener rangos visitados en vez de virtualizar de verdad, lo que crea problemas de memoria, suscripciones y comportamiento difícil de razonar.

La reescritura necesita conservar la experiencia funcional que hace útil a libt, pero sobre el modelo block-first ya definido: todo contenido creado por el usuario es un Block, los Daily Blocks son los únicos root blocks, las fechas derivan del Daily Block ancestro, y las vistas especiales no son fuentes alternativas de verdad.

## Solution

Implementar el layout general de la app y la primera versión completa de la vista Daily.

En desktop, la app debe usar shell de tres zonas: navegación izquierda, Daily View al centro y sidebar contextual derecha con calendario y entrada de IA. En mobile, la app no debe usar sidebars ni drawers equivalentes; debe seguir el concepto actual de libt: bottom navigation para secciones principales, timeline horizontal superior para fechas en Daily, y botón flotante superior derecho para abrir la IA como overlay o pantalla dedicada.

La Daily View debe permitir navegar indefinidamente por fechas pasadas y futuras con virtualización acotada. Los días sin contenido se muestran como Daily Timeline Shells client-side y no crean registros en la base de datos. Los Daily Blocks persistidos se consultan por rango de fechas y se renderizan solo cuando existen o cuando una operación real necesita insertar o mover un bloque a esa fecha.

La experiencia principal debe cubrir creación, edición, jerarquía, todo básico, drag and drop entre bloques y días, y sincronización de fecha enfocada con calendario/timeline.

## User Stories

1. Como usuario, quiero abrir la app en la vista diaria, para capturar notas y todos desde el flujo natural del día.

2. Como usuario mobile, quiero ver una navegación inferior con las secciones principales, para moverme por la app sin usar sidebars comprimidas.

3. Como usuario mobile, quiero una timeline horizontal superior de fechas, para cambiar de día rápidamente sin abandonar la Daily View.

4. Como usuario mobile, quiero un botón flotante de IA arriba a la derecha, para abrir el asistente sin ocupar espacio permanente en pantalla.

5. Como usuario desktop, quiero una sidebar izquierda de navegación, para acceder a Daily, Todos, Folders, Favoritos y otras secciones del shell.

6. Como usuario desktop, quiero una sidebar derecha con calendario y entrada de IA, para mantener contexto temporal y acceso al asistente mientras trabajo en notas.

7. Como usuario, quiero hacer scroll hacia el pasado y el futuro por todos los días, para revisar o planificar sin límites artificiales.

8. Como usuario, quiero que los días vacíos aparezcan en la UI sin crear Daily Blocks vacíos, para que mi base de datos refleje solo contenido real.

9. Como usuario, quiero que la app cargue Daily Blocks reales por rango de fechas mientras navego, para ver contenido persistido cuando corresponde.

10. Como usuario, quiero crear un Text Block dentro de cualquier día visible, para capturar una nota en esa fecha.

11. Como usuario, quiero editar el contenido de un Block directamente en la Daily View, para trabajar rápido sin abrir otra pantalla.

12. Como usuario, quiero presionar Enter para crear el siguiente Block, para capturar notas como outline continuo.

13. Como usuario, quiero indentar y desindentar Blocks, para construir árboles de contenido dentro de un día.

14. Como usuario, quiero convertir un Block en Todo usando la interacción básica de libt, como `[]`, para capturar tareas desde el texto.

15. Como usuario, quiero completar y descompletar Todos, para mantener seguimiento básico de tareas.

16. Como usuario, quiero arrastrar Blocks dentro del mismo día, para reordenar o reorganizar su árbol.

17. Como usuario, quiero arrastrar Blocks entre días, para cambiar su fecha canónica moviendo el subtree completo.

18. Como usuario, quiero ver claramente durante drag and drop si el Block caerá antes, después o como hijo de otro Block, para evitar movimientos ambiguos.

19. Como usuario, quiero que un Block colapsado se expanda si mantengo el drag sobre él durante 2 segundos como target hijo, para poder soltar dentro de su subtree sin una acción separada.

20. Como usuario, quiero que el calendario desktop y la timeline mobile indiquen el día enfocado según el scroll, para entender qué fecha estoy viendo.

21. Como usuario, quiero hacer click o tap en una fecha del calendario o timeline y navegar a esa fecha, para saltar rápidamente a días específicos.

## Implementation Decisions

- Usar el vocabulario block-first del dominio. No reintroducir Page, Document o Line como entidades de dominio para contenido creado por el usuario.

- La Daily View debe apoyarse sobre Daily Blocks, Text Blocks y Todo Blocks existentes. Los Daily Blocks son los únicos root blocks.

- Hacer scroll, enfocar o renderizar una fecha no crea un Daily Block. Solo se crea un Daily Block cuando una operación necesita insertar o mover un Block hijo a esa fecha.

- Los días vacíos se representan como Daily Timeline Shells client-side. Estos shells no son registros persistidos ni placeholders en la base de datos.

- La timeline diaria debe usar virtualización acotada real. El usuario puede navegar indefinidamente por fechas pasadas y futuras, pero la UI mantiene montada solo una ventana razonable alrededor del viewport.

- El fetch de datos persistidos debe hacerse por rango de fechas para la ventana visible o prefetch window. El rango de datos y el rango montado deben poder ser acotados para evitar el patrón expand-only de la app anterior.

- El Focused Date es estado derivado del viewport de la Daily View. No se persiste en base de datos. El calendario y la timeline mobile reflejan ese valor.

- Clicks o taps en calendario/timeline son comandos de navegación hacia una fecha. Después del salto, el Focused Date vuelve a derivarse de la posición visible.

- Mover un Block a otro día mueve el Block y todo su descendant tree bajo el Daily Block destino. La fecha canónica cambia para todo el subtree porque cambia su Daily Block Membership.

- Si un movimiento o creación apunta a un día sin Daily Block persistido, la operación debe crear idempotentemente el Daily Block destino antes de insertar o mover el Block.

- Drag and drop debe resolver a una operación explícita de árbol: insertar antes de un sibling, insertar después de un sibling, o insertar como child.

- La UI de drag and drop debe mostrar el target resuelto: línea entre Blocks para before/after, borde o highlight de Block completo para child.

- Si el usuario mantiene un drag durante 2 segundos sobre un Block colapsado como child target, el Block debe expandirse para permitir drop dentro de su subtree.

- Al mover un subtree, se preserva su orden interno y metadata asociada, incluyendo folder assignments, estado de Todo, prioridad y due time.

- Al soltar sobre espacio vacío de un día, el Block se inserta al final de los hijos directos del Daily Block de esa fecha.

- Al soltar sobre un Block concreto, la zona de drop define si el Block queda antes, después o como hijo.

- El layout desktop debe tener navegación izquierda, contenido central y sidebar contextual derecha. La sidebar derecha puede exponer calendario y shell/entrada de IA aunque la IA real no esté implementada en este PRD.

- El layout mobile debe tener bottom navigation con las secciones principales actuales de libt mobile: Daily/Home, Folders, Tasks y Profile. No debe renderizar sidebars mobile.

- La Daily View mobile debe tener timeline horizontal sticky arriba. Esta timeline navega fechas y refleja el Focused Date.

- La IA mobile debe abrirse desde un botón flotante superior derecho como overlay o pantalla dedicada. La funcionalidad real del agente queda fuera de alcance.

- Las secciones de shell todavía no implementadas deben usar placeholders explícitos o navegación stub. No deben crear estado local que parezca fuente de verdad ni duplicar el modelo de Blocks.

- Mantener deep modules: la UI debe llamar APIs pequeñas y estables para operaciones de Daily Timeline, Block Tree, Block Editing y DnD. Las reglas de dominio no deben vivir dentro de componentes grandes.

- La lógica pura de planificación de tree operations debe ser testeable sin base de datos cuando sea razonable. La persistencia debe quedar detrás de servicios/mutators.

- Los cambios de base de datos, si aparecen, deben ir por migraciones. Este PRD parte del schema block-first existente y no requiere rediseñar el modelo base salvo que la implementación encuentre una restricción faltante.

## Testing Decisions

- Agregar tests unitarios para la lógica pura de timeline/date window, resolución de drop targets, planificación de movimiento de subtrees, creación lazy de Daily Blocks y actualización de Daily Block Membership.

- Agregar tests unitarios para operaciones de orden entre siblings, incluyendo before, after, child y append al final de un Daily Block.

- Agregar tests de servicio o integración para comprobar que scroll/focus/render de shells no crea Daily Blocks persistidos.

- Agregar tests de servicio o integración para comprobar que crear un Block en un día vacío crea idempotentemente el Daily Block y luego el hijo.

- Agregar tests de servicio o integración para comprobar que mover un Block entre días mueve todo el subtree y actualiza Daily Block Membership para cada descendiente.

- Agregar e2e desktop para login seeded, carga de Daily View, creación de Text Block, edición, Enter para nuevo Block, indent/outdent, conversión a Todo y completar/descompletar.

- Agregar e2e desktop para scroll infinito virtualizado, cambio de Focused Date y calendario reflejando la fecha visible.

- Agregar e2e desktop para navegación desde calendario hacia una fecha fuera del rango montado inicial.

- Agregar e2e desktop para drag and drop básico: before/after dentro del mismo día, child drop y movimiento a otro día.

- Agregar e2e para drop sobre día vacío, validando que la UI muestra el Block movido y que el Daily Block destino se crea solo por la operación.

- Agregar e2e para expansión de Block colapsado tras mantener drag durante 2 segundos sobre child target.

- Agregar e2e mobile para bottom navigation, timeline superior, navegación por fecha, Focused Date y botón flotante de IA.

- Los e2e deben apoyarse en seeders mantenidos. Antes de validar una implementación de alta complejidad, se debe resetear la base de datos local y ejecutar la suite e2e completa.

- Linter, unit tests, build, migraciones y e2e deben quedar verdes. Cualquier falla detectada durante validación debe arreglarse antes de considerar completa la feature.

## Out of Scope

- IA real, herramientas del agente, memoria del agente e integración con modelos.

- Folders funcionales como vista filtrada real.

- Favoritos reales.

- Search global.

- Recurrencias de Todos en la UI.

- Integración de calendario externo y CRUD de eventos externos.

- Meeting transcription, video transcription, resúmenes y extracción de follow-ups.

- Daily review.

- Implementar todas las funcionalidades de las sidebars. En este PRD las sidebars y navegación secundaria pueden existir como shell/stub.

- Cambiar el modelo base block-first ya acordado, salvo migraciones puntuales necesarias para soportar correctamente las operaciones de esta feature.

## Further Notes

- La app existente de libt es guía funcional, no fuente de implementación. Se deben preservar los conceptos que funcionan, pero no copiar componentes ni patrones frágiles.

- La implementación debe evitar el patrón anterior de componentes monolíticos donde UI, queries, mutaciones, parsing, DnD y calendario quedan mezclados.

- El patrón expand-only de fechas montadas está explícitamente descartado. La nueva Daily View debe poder desmontar días visitados sin perder estado canónico porque la fuente de verdad está en DB/Zero.

- Las vistas especiales y shell navigation deben seguir siendo proyecciones o accesos al mismo modelo de Blocks. Ninguna vista debe convertirse en dueña alternativa del contenido.
