import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// ✅ Importar SafeAreaView desde su paquete actualizado
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = "http://192.168.100.19:3000";

const TIPOS = ["Inundación", "Deslizamiento", "Sismo", "Erupción volcánica"];
const SEVERIDADES = ["Baja", "Media", "Alta", "Crítica"];
const ESTADOS = ["Pendiente", "En revisión", "Atendido"];

export default function App() {
  const [pantalla, setPantalla] = useState("inicio");
  const [token, setToken] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modoRegistro, setModoRegistro] = useState(true);
  const [reportes, setReportes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [ubicacion, setUbicacion] = useState("");
  const [severidad, setSeveridad] = useState("Media");
  const [descripcion, setDescripcion] = useState("");
  const [reporteEditando, setReporteEditando] = useState(null);

  async function solicitar(ruta, opciones = {}) {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.error || "No se pudo completar la solicitud");
    }

    return datos;
  }

  async function iniciarSesion() {
    if (!email.trim() || !password) {
      Alert.alert("Faltan datos", "Escribe tu correo y contraseña.");
      return;
    }

    if (modoRegistro && !nombre.trim()) {
      Alert.alert("Falta tu nombre", "Escribe tu nombre para registrarte.");
      return;
    }

    setCargando(true);

    try {
      const ruta = modoRegistro ? "/api/auth/register" : "/api/auth/login";
      const cuerpo = modoRegistro
        ? { name: nombre.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const respuesta = await fetch(`${API_URL}${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(datos.error || "No se pudo acceder");
      }

      setToken(datos.token);
      // Cambia esta línea:
      setNombre(datos.user?.name || nombre);
      setPantalla("reportes");
    } catch (error) {
      Alert.alert("No se pudo conectar o acceder", error.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarReportes() {
    if (!token) return;

    setCargando(true);
    try {
      const datos = await solicitar("/api/reports?limit=50&offset=0");
      setReportes(datos);
    } catch (error) {
      Alert.alert("Error al cargar reportes", error.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (token) cargarReportes();
  }, [token]);

  function limpiarFormulario() {
    setTipo(TIPOS[0]);
    setUbicacion("");
    setSeveridad("Media");
    setDescripcion("");
    setReporteEditando(null);
  }

  async function guardarReporte() {
    if (!ubicacion.trim() || !descripcion.trim()) {
      Alert.alert("Faltan datos", "Completa la ubicación y la descripción.");
      return;
    }

    setCargando(true);

    try {
      const cuerpo = {
        type: tipo,
        location: ubicacion.trim(),
        severity: severidad,
        description: descripcion.trim(),
        status: reporteEditando?.status || "Pendiente",
      };

      if (reporteEditando) {
        await solicitar(`/api/reports/${reporteEditando.id}`, {
          method: "PUT",
          body: JSON.stringify(cuerpo),
        });
        Alert.alert("Reporte actualizado", "Los cambios se guardaron.");
      } else {
        await solicitar("/api/reports", {
          method: "POST",
          body: JSON.stringify(cuerpo),
        });
        Alert.alert("Reporte creado", "Se guardó correctamente.");
      }

      limpiarFormulario();
      setPantalla("reportes");
      await cargarReportes();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message);
    } finally {
      setCargando(false);
    }
  }

  function editarReporte(reporte) {
    setReporteEditando(reporte);
    setTipo(reporte.type);
    setUbicacion(reporte.location);
    setSeveridad(reporte.severity);
    setDescripcion(reporte.description);
    setPantalla("formulario");
  }

  async function cambiarEstado(reporte) {
    const nuevoEstado =
      ESTADOS[(ESTADOS.indexOf(reporte.status) + 1) % ESTADOS.length];

    try {
      await solicitar(`/api/reports/${reporte.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...reporte, status: nuevoEstado }),
      });
      await cargarReportes();
    } catch (error) {
      Alert.alert("No se pudo actualizar", error.message);
    }
  }

  function eliminarReporte(reporte) {
    Alert.alert(
      "Eliminar reporte",
      `¿Quieres eliminar el reporte de ${reporte.type} en ${reporte.location}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await solicitar(`/api/reports/${reporte.id}`, {
                method: "DELETE",
              });
              await cargarReportes();
            } catch (error) {
              Alert.alert("No se pudo eliminar", error.message);
            }
          },
        },
      ]
    );
  }

  function cerrarSesion() {
    setToken("");
    setReportes([]);
    setPantalla("inicio");
    setEmail("");
    setPassword("");
    limpiarFormulario();
  }

  function boton(texto, accion, estilo = {}) {
    return (
      <TouchableOpacity
        onPress={accion}
        style={[styles.boton, estilo]}
        accessibilityRole="button"
      >
        <Text style={styles.textoBoton}>{texto}</Text>
      </TouchableOpacity>
    );
  }

  function opciones(valores, seleccionado, alSeleccionar) {
    return (
      <View style={styles.opciones}>
        {valores.map((valor) => (
          <TouchableOpacity
            key={valor}
            onPress={() => alSeleccionar(valor)}
            style={[
              styles.opcion,
              seleccionado === valor && styles.opcionActiva,
            ]}
          >
            <Text
              style={[
                styles.textoOpcion,
                seleccionado === valor && styles.textoOpcionActivo,
              ]}
            >
              {valor}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  function campo(etiqueta, valor, cambiar, multilinea = false) {
    return (
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        <TextInput
          value={valor}
          onChangeText={cambiar}
          placeholder={etiqueta}
          placeholderTextColor="#8293A5"
          style={[styles.entrada, multilinea && styles.multilinea]}
          multiline={multilinea}
          autoCapitalize="sentences"
        />
      </View>
    );
  }

  function tarjetaReporte({ item }) {
    return (
      <View style={styles.tarjeta}>
        <View style={styles.fila}>
          <Text style={styles.tituloTarjeta}>{item.type}</Text>
          <Text
            style={[
              styles.etiquetaNivel,
              item.severity === "Crítica" && styles.nivelCritico,
              item.severity === "Alta" && styles.nivelAlto,
            ]}
          >
            {item.severity}
          </Text>
        </View>
        <Text style={styles.textoTarjeta}>📍 {item.location}</Text>
        <Text style={styles.textoTarjeta}>{item.description}</Text>
        <Text style={styles.estado}>Estado: {item.status}</Text>
        <View style={styles.filaBotones}>
          <TouchableOpacity
            onPress={() => cambiarEstado(item)}
            style={styles.botonSecundario}
          >
            <Text style={styles.textoSecundario}>Cambiar estado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => editarReporte(item)}
            style={styles.botonSecundario}
          >
            <Text style={styles.textoSecundario}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => eliminarReporte(item)}
            style={[styles.botonSecundario, styles.botonEliminar]}
          >
            <Text style={styles.textoEliminar}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor="#10243A" />
      <KeyboardAvoidingView
        style={styles.contenedor}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.encabezado}>
          <Text style={styles.marca}>🛡️ ALERT GUARD</Text>
          <Text style={styles.submarca}>Gestión comunitaria de riesgos</Text>
        </View>

        {pantalla === "inicio" && (
          <ScrollView contentContainerStyle={styles.contenido}>
            <Text style={styles.titulo}>Tu comunidad, mejor preparada</Text>
            <Text style={styles.parrafo}>
              Registra y consulta reportes comunitarios de posibles riesgos
              naturales en Ecuador.
            </Text>

            {modoRegistro && campo("Nombre", nombre, setNombre)}
            {campo("Correo electrónico", email, setEmail)}
            {campo("Contraseña (mínimo 6 caracteres)", password, setPassword)}

            {boton(
              cargando
                ? "Procesando..."
                : modoRegistro
                ? "Crear cuenta"
                : "Iniciar sesión",
              iniciarSesion
            )}

            <TouchableOpacity
              onPress={() => setModoRegistro(!modoRegistro)}
              style={styles.enlace}
            >
              <Text style={styles.textoEnlace}>
                {modoRegistro
                  ? "¿Ya tienes cuenta? Inicia sesión"
                  : "¿No tienes cuenta? Regístrate"}
              </Text>
            </TouchableOpacity>

            <View style={styles.aviso}>
              <Text style={styles.avisoTexto}>
                Prototipo académico: las alertas y reportes no reemplazan los
                canales oficiales de emergencia.
              </Text>
            </View>
          </ScrollView>
        )}

        {pantalla === "reportes" && (
          <View style={styles.contenidoLista}>
            <View style={styles.fila}>
              <View>
                <Text style={styles.titulo}>Hola, {nombre}</Text>
                <Text style={styles.parrafo}>Reportes de riesgo comunitario</Text>
              </View>
              <TouchableOpacity onPress={cerrarSesion}>
                <Text style={styles.textoEnlace}>Salir</Text>
              </TouchableOpacity>
            </View>

            {boton(
              "+ Crear reporte",
              () => {
                limpiarFormulario();
                setPantalla("formulario");
              }
            )}

            {cargando ? (
              <ActivityIndicator size="large" color="#0C8F83" />
            ) : (
              <FlatList
                data={reportes}
                keyExtractor={(item) => String(item.id)}
                renderItem={tarjetaReporte}
                onRefresh={cargarReportes}
                refreshing={cargando}
                ListEmptyComponent={
                  <Text style={styles.vacio}>
                    Aún no hay reportes. Crea el primero.
                  </Text>
                }
                contentContainerStyle={styles.lista}
              />
            )}
          </View>
        )}

        {pantalla === "formulario" && (
          <ScrollView contentContainerStyle={styles.contenido}>
            <Text style={styles.titulo}>
              {reporteEditando ? "Editar reporte" : "Nuevo reporte"}
            </Text>

            <Text style={styles.etiqueta}>Tipo de riesgo</Text>
            {opciones(TIPOS, tipo, setTipo)}

            {campo("Ubicación (cantón, provincia o sector)", ubicacion, setUbicacion)}

            <Text style={styles.etiqueta}>Severidad</Text>
            {opciones(SEVERIDADES, severidad, setSeveridad)}

            {campo("Descripción del riesgo", descripcion, setDescripcion, true)}

            {boton(cargando ? "Guardando..." : "Guardar reporte", guardarReporte)}
            <TouchableOpacity
              onPress={() => {
                limpiarFormulario();
                setPantalla("reportes");
              }}
              style={styles.enlace}
            >
              <Text style={styles.textoEnlace}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F2F6F8" },
  encabezado: {
    backgroundColor: "#10243A",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  marca: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  submarca: { color: "#BCD0DF", marginTop: 4, fontSize: 13 },
  contenido: { padding: 22, paddingBottom: 40 },
  contenidoLista: { flex: 1, padding: 18 },
  titulo: { color: "#10243A", fontSize: 24, fontWeight: "800", marginBottom: 8 },
  parrafo: { color: "#596C7E", fontSize: 15, lineHeight: 22, marginBottom: 18 },
  campo: { marginBottom: 16 },
  etiqueta: { color: "#20394F", fontWeight: "700", marginBottom: 7 },
  entrada: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D5E0E7",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: "#10243A",
    fontSize: 15,
  },
  multilinea: { minHeight: 100, textAlignVertical: "top" },
  boton: {
    backgroundColor: "#087F73",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 9,
  },
  textoBoton: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  enlace: { padding: 12, alignItems: "center" },
  textoEnlace: { color: "#087F73", fontWeight: "700" },
  aviso: {
    backgroundColor: "#FFF4D6",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  avisoTexto: { color: "#705A23", lineHeight: 20 },
  opciones: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  opcion: {
    borderColor: "#C7D5DF",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginRight: 7,
    marginBottom: 7,
    backgroundColor: "#FFFFFF",
  },
  opcionActiva: { backgroundColor: "#087F73", borderColor: "#087F73" },
  textoOpcion: { color: "#334B5E", fontSize: 13 },
  textoOpcionActivo: { color: "#FFFFFF", fontWeight: "700" },
  lista: { paddingBottom: 35 },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginBottom: 12,
    borderRadius: 14,
    borderColor: "#E0E8ED",
    borderWidth: 1,
  },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  tituloTarjeta: { fontSize: 17, fontWeight: "800", color: "#10243A" },
  etiquetaNivel: {
    color: "#64531A",
    backgroundColor: "#FFF2BF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
    fontWeight: "700",
  },
  nivelAlto: { color: "#9A4E13", backgroundColor: "#FFE4C8" },
  nivelCritico: { color: "#A82222", backgroundColor: "#FFE0E0" },
  textoTarjeta: { color: "#526578", marginVertical: 4, lineHeight: 20 },
  estado: { color: "#087F73", fontWeight: "700", marginTop: 5 },
  filaBotones: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  botonSecundario: {
    borderWidth: 1,
    borderColor: "#CCD9E2",
    borderRadius: 9,
    padding: 8,
    marginRight: 6,
    marginTop: 5,
  },
  textoSecundario: { color: "#27465B", fontSize: 12, fontWeight: "700" },
  botonEliminar: { borderColor: "#F0C6C6" },
  textoEliminar: { color: "#B12D2D", fontSize: 12, fontWeight: "700" },
  vacio: { textAlign: "center", color: "#718394", marginTop: 30 },
});