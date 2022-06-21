const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Clientes");
const Pedido = require("../models/Pedido");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });
//Resolver

const crearToken = (usuario, secreta, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

const resolvers = {
  Query: {
    obtenerUsuario: async (_, {}, ctx) => {
   
      return ctx.usuario;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.error(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      // Revisar si existe el producto
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.error(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return clientes;
      } catch (error) {
        console.error(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      // Revisar si el cliente existe
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("El cliente no existe");
      }
      // Quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
        throw new Error("El cliente no está asignado a este vendedor");
      }

      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.error(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({
          vendedor: ctx.usuario.id.toString(),
        }).populate('cliente');// populate para traer los datos del cliente en la colección respectiva mediante el id
        return pedidos;
      } catch (error) {
        console.error(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      // Revisar si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      // Quien lo creo puede verlo
      if (pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
        throw new Error("El pedido no está asignado a este vendedor");
      }

      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado });
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $limit: 10
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" }
          }},
          {
            $lookup: {
               from: "usuarios",
               localField: "_id",
               foreignField: "_id",
               as: "vendedor"
            }
          },
          {
            $limit: 3
          },
          {
            $sort: { total: -1 }
          }

      ]);
       return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({ $text: {$search: texto}})
      return productos;
    }
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;
      // Revisar si el usuario ya ha sido registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya existe");
      }
      // Hashear elpassword
      const salt = await bcryptjs.genSaltSync(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        // Guardarlo enla db
        const usuario = new Usuario(input);
        usuario.save(); // guardarlo
        return usuario;
      } catch (error) {
        console.error(error);
      }
    },

    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //Si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no está registrado");
      }

      // Revisar si el password es correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("El password no es correcto");
      }

      // Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        // Almacenar en la db
        const resultado = producto.save();
        return resultado;
      } catch (error) {
        console.error(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      // Revisar si el producto existe
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("El producto no existe");
      }

      // Guardar en la db
      producto = await Producto.findByIdAndUpdate({ _id: id }, input, {
        new: true,
      });

      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      // Verificar si existe el producto
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("El producto no existe");
      }
      // Eliminar de la base de datos
      await Producto.findByIdAndDelete({ _id: id });
      return "Producto eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      //console.log(ctx);
      console.log('Input cliente: ',input);
      const { email } = input;
      //  Verificar si el cliente ya está registrado
      const cliente = await Cliente.findOne({ email });
      console.log('client encontrado:',cliente);
      if (cliente) {
        throw new Error("El cliente ya está regsitrado");
      }

      // Intanciando un cliente del modelo
      const nuevoCliente = new Cliente(input);
      // Asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id;

      try {
        // almacenando en la db
        const resultado = await nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.error(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      // verificar si existe el cliente
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no existe");
      }
      // Verificar si el vendedor es quien edita
     /* if (cliente.vendedor !== ctx.usuario.id) {
        throw new Error("El cliente no está asignado a este vendedor");
      }*/
      
      // Guardar cambios en cliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // verificar si existe el cliente
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no existe");
      }
      // Verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
        throw new Error("El cliente no está asignado a este vendedor");
      }
      // Eliminar de la base de datos
      await Cliente.findByIdAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;

      // verificar si existe el cliente
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) {
        throw new Error("Cliente no existe");
      }

      // Verificar si el cinete le pertenece al vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id.toString()) {
        throw new Error("El cliente no está asignado a este vendedor");
      }
      //  Revisar que el stock esté disponible
      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);

        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El artículo ${producto.nombre} excede la cantidad disponible`
          );
        } else {
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      // Crear un nuevo pedido
      const nuevoPedido = new Pedido(input);
      // Asignar un vendedor
      nuevoPedido.vendedor = ctx.usuario.id;
      // Guardarlo en la db
      const resultado = await nuevoPedido.save();
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      // verificar si existe el pedido
      let existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error("Pedido no existe");
      }

      // Si el cliente existe
      let existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error("Cliente no existe");
      }

      // Si el cliente y pedido pertenece al vendedor
      if (existeCliente.vendedor.toString() !== ctx.usuario.id.toString()) {
        throw new Error("El cliente no está asignado a este vendedor");
      }

      // Revisar el stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);

          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `El artículo ${producto.nombre} excede la cantidad disponible`
            );
          } else {
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      // Guardar cambios en pedido
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      // Verificar si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      //Verificar si el pedido pertenece al vendedor

      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("El pedido no pertenece al vendedor");
      }
      // Eliminar de la base de datos
      await Pedido.findOneAndDelete({ _id: id });
      return " Pedido eliminado";
    },
  },
};

module.exports = resolvers;
