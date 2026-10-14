# Modo de Impresión Térmica Directa para Cocina (Sin Pantalla/KDS)

Sistema para permitir la operación de restaurantes que no disponen de pantalla ni PC en cocina, permitiendo enviar comandas directamente a impresoras térmicas (80mm / 58mm) desde Caja o Mesero, con un conmutador de configuración global entre **Modo KDS (Pantalla)** y **Modo Impresión Directa (Sin Pantalla)**.

---

## Decisiones Confirmadas por el Usuario

> [!IMPORTANT]
> El usuario ha especificado el comportamiento exacto para adaptar la operación a negocios sin equipamiento en cocina:

1. **Modo de Operación Configurable**: Opción global en el panel de Administración / Configuración para alternar entre `Modo KDS (Pantalla)` y `Modo Impresión Directa (Térmica / Sin Pantalla)`.
2. **Estado de Platillos al Enviar Pedido**: Los pedidos enviados desde Caja o Mesero cambiarán a estado `enviado` / `comanda_enviada` (en lugar de `listo` o `entregado`), reflejando que la comanda fue despachada a la cocina sin alterar el control de tiempos.
3. **Impresión Térmica**: Botón manual de **"Imprimir Comanda Cocina"** e impresión automática en formato de ticket térmico optimizado para anchos de **80mm** y **58mm** con selección de tamaño.

---

## 1. Visión General del Producto

Esta funcionalidad permite que el POS de BistroFlow opere sin requerir hardware dedicado en cocina (monitores o tablets KDS). La PC de Caja (con impresoras térmicas conectadas) o el dispositivo del mesero se encarga de formatear e imprimir la comanda de cocina de forma limpia y clara al momento de guardar o enviar la orden.

### Beneficios Clave
- **Cero inversión en hardware de cocina**: Ideal para pequeños restaurantes, food trucks o cocinas sin espacio/presupuesto para pantallas.
- **Formato térmico estandarizado**: Formateo de tickets de cocina en 80mm y 58mm con separadores visuales claros, número de mesa, mesero, items, modificaciones ("SIN cebolla", "+ Queso Extra") y notas especiales.
- **Transición suave**: Activación/desactivación con un solo clic en Ajustes para cuando el restaurante decida incorporar pantallas KDS en el futuro.

---

## 2. Experiencia de Usuario y Flujo Visual

### A. Panel de Ajustes (MenuSettingsView)
- Nueva sección dentro de **Ajustes del Restaurante / Configuración General**:
  - **Modo de Cocina**: Interruptor entre `Pantalla KDS Activa` y `Modo Impresión Directa (Sin Pantalla)`.
  - **Ancho de Papel Térmico de Cocina**: Selector entre `80mm (Estándar)` y `58mm (Compacto)`.
  - **Auto-imprimir Comanda de Cocina al Enviar**: Interruptor ON/OFF para disparar la impresión automáticamente al hacer clic en "Enviar a Cocina" o facturar en Caja.

### B. Vista de Mesero y Caja (WaiterView / CajaView)
- Al presionar **"Enviar a Cocina"** o registrar un pedido:
  - Si el **Modo Impresión Directa** está activo:
    - Se registra el estado de la comanda como `enviado` (en lugar de quedar esperando acción en KDS).
    - Se genera e imprime la comanda de cocina en la impresora asignada o cuadro de impresión del navegador.
    - Se incluye una opción visible **"🖨️ Imprimir Comanda Cocina"** en los detalles de la mesa/comanda para reimpresión manual si la cinta de papel se atascó o falló.

### C. Módulo KDS (KDSView)
- Cuando el modo sin pantalla está activo, si un usuario ingresa a la pestaña KDS, verá un indicador informativo claro de que el sistema está operando en **Modo Impresión Térmica Directa**, ofreciendo un acceso directo para cambiar el modo si lo desea.

---

## 3. Decisiones de Producto y Arquitectura de Datos

1. **Estructura de Configuración (`settings` en Firestore)**:
   - `kitchenMode`: `'kds'` | `'direct_print'` (Por defecto: `'kds'`).
   - `kitchenPaperWidth`: `'80mm'` | `'58mm'` (Por defecto: `'80mm'`).
   - `autoPrintKitchenTicket`: `boolean` (Por defecto: `true`).

2. **Formato de Ticket Térmico de Cocina (Kitchen Ticket Component)**:
   - Encabezado destacado: ***** COMANDA DE COCINA ***
   - Datos clave: `MESA #02` | `MESERO: Juan` | `HORA: 18:12` | `ORDEN #104`
   - Lista de platillos en letra grande de alto contraste.
   - Especificaciones resaltadas: `[SIN CEBOLLA]` en fuente negrita/inversa o marco visible.
   - Notas de mesa y número de asiento.

---

## 4. Diagrama de Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURACIÓN GENERAL                         │
│                    (kitchenMode: 'direct_print' | 'kds')                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [Modo KDS (Pantalla)]               [Modo Impresión Directa]
    - Cola interactiva KDS              - Estado orden: 'enviado'
    - Tiempos de preparación            - Auto-impresión comanda cocina
    - Avance manual de platos           - Ticket térmico 80mm / 58mm
                                        - Botón reimpresión manual
```

---

## Pasos de Ejecución

1. **Configuración en Firestore & Contexto (`useRestaurantData`)**:
   - Agregar campos `kitchenMode`, `kitchenPaperWidth`, y `autoPrintKitchenTicket` en el esquema de ajustes de restaurante.
2. **Panel de Control en `MenuSettingsView.tsx`**:
   - Diseñar los controles de alternancia de modo de cocina e impresoras térmicas.
3. **Componente e Helper de Impresión de Comanda (`lib/printer.ts` / `KitchenTicketPrint.tsx`)**:
   - Crear utilidad de impresión adaptada a 80mm/58mm en CSS print-media sin desbordamientos ni márgenes excedentes.
4. **Integración en `WaiterView.tsx` y `CajaView.tsx`**:
   - Modificar la lógica de envío de pedido para respetar `kitchenMode`.
   - Agregar botón de reimpresión de comanda de cocina.
5. **Verificación y Verificación de Compilación**:
   - Comprobación con `compile_applet` y `lint_applet`.
