const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const { GraphQLError } = require('graphql')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

mongoose.set('strictQuery', false)

const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('connected to MongoDB')
    })
    .catch(() => {
        console.log('error connection to MongoDB:', error.message)
    })



const typeDefs = `

    type Mutation {
        addBook(
            title: String!
            author: String!
            published: Int!
            genres: [String!]!
        ): Book
        editAuthor(
            name: String!
            setBornTo: Int
        ): Author
        createUser(
            username: String!
            favoriteGenre: String!
        ): User
        login(
            username: String!
            password: String!
        ): Token
    }

    type User{
        username: String!
        favoriteGenre: String!
        id: ID!
    }

    type Token{
        value: String!
    }


    type Author {
        name: String!
        id: ID!
        born: Int
        bookCount: Int!
    }

    type Book {
        title: String!,
        published: Int!,
        author: Author!,
        id: ID!,
        genres: [String!]!
    }

    type Query {
        bookCount: Int!
        authorCount: Int!
        allBooks(author: String, genre: String): [Book!]!
        allAuthors: [Author!]!
        me: User
    }
`

const resolvers = {
    Query: {
        bookCount: async () => Book.collection.countDocuments(),
        authorCount: async () => Author.collection.countDocuments(),
        allBooks: async (root, args) => {
            console.log('allBooks.args', args)
            let filter = {}

            // If author is given, find their ObjectId
            if (args.author) {
                const author = await Author.findOne({ name: args.author })
                if (!author) {
                    return [] // Return empty array if author is not found
                }
                filter.author = author._id
            }

            // If genre is given, add it to the filter
            if (args.genre) {
                filter.genres = args.genre
            }

            // Fetch books based on the constructed filter
            return await Book.find(filter).populate('author')
        },
        allAuthors: async () => {
            return await Author.find({})
        }
    },
    Author: {
        bookCount: async (author) => {
            return await Book.countDocuments({ author: author._id })
        }
    },
    Mutation: {
        addBook: async (root, args, context) => {

            let author = await Author.findOne({ name: args.author })
            const currentUser = context.currentUser

            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            // if author doesn't exist, create a new one
            if (!author) {
                console.log('no author, create one')
                author = new Author({ name: args.author, born: null })
                author.born = null
                try {
                    await author.save()
                } catch (error) {
                    throw new GraphQLError('Saving author failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args.author,
                            errror
                        }
                    })
                }
            }

            console.log('author', author)

            // create a new book with the author's id
            const book = new Book({
                title: args.title,
                published: args.published,
                genres: args.genres,
                author: author._id // reference the author's id
            })

            try {
                await book.save()
            } catch (error) {
                throw new GraphQLError('Saving book failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.title,
                        error
                    }
                })
            }
            return book.populate('author')
        },
        editAuthor: async (root, args, context) => {

            const currentUser = context.currentUser

            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            let author = await Author.findOne({ name: args.name })

            console.log('args.name')

            if (!author) {
                throw new GraphQLError('Author not found', {
                    extensions: { code: 'BAD_USER_INPUT' }
                });
            }


            // author.born = args.setBornTo;
            author.set('born', args.setBornTo);

            try {
                author.save()
            } catch (error) {
                throw new GraphQLError('Saving born year failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return author

        },
        createUser: async (root, args) => {
            const user = User({ username: args.username, favoriteGenre: args.favoriteGenre })

            return user.save()
                .catch(error => {
                    throw new GraphQLError('Creating the user failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args.username,
                            error
                        }
                    })
                })
        },
        login: async (root, args) => {
            const user = await User.findOne({ username: args.username })

            if (!user || args.password !== 'secret') {
                throw new GraphQLError('wrong credentials', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            const userForToken = {
                username: user.username,
                id: user._id
            }

            return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req, res }) => {
        const auth = req ? req.headers.authorization : null
        if (auth && auth.startsWith('Bearer ')) {
            const decodedToken = jwt.verify(
                auth.substring(7), process.env.JWT_SECRET
            )

            const currentUser = await User
                .findById(decodedToken.id)
            return { currentUser }
        }
    }
}).then(({ url }) => {
    console.log(`Server ready at ${url}`)
})