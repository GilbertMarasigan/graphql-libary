const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const { GraphQLError } = require('graphql')


let authors = [
    {
        name: 'Robert Martin',
        id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
        born: 1952,
    },
    {
        name: 'Martin Fowler',
        id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
        born: 1963
    },
    {
        name: 'Fyodor Dostoevsky',
        id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
        born: 1821
    },
    {
        name: 'Joshua Kerievsky', // birthyear not known
        id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
    },
    {
        name: 'Sandi Metz', // birthyear not known
        id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
    },
]

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
 *
 * Spanish:
 * Podría tener más sentido asociar un libro con su autor almacenando la id del autor en el contexto del libro en lugar del nombre del autor
 * Sin embargo, por simplicidad, almacenaremos el nombre del autor en conexión con el libro
*/

let books = [
    {
        title: 'Clean Code',
        published: 2008,
        author: 'Robert Martin',
        id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Agile software development',
        published: 2002,
        author: 'Robert Martin',
        id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
        genres: ['agile', 'patterns', 'design']
    },
    {
        title: 'Refactoring, edition 2',
        published: 2018,
        author: 'Martin Fowler',
        id: "afa5de00-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Refactoring to patterns',
        published: 2008,
        author: 'Joshua Kerievsky',
        id: "afa5de01-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'patterns']
    },
    {
        title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
        published: 2012,
        author: 'Sandi Metz',
        id: "afa5de02-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'design']
    },
    {
        title: 'Crime and punishment',
        published: 1866,
        author: 'Fyodor Dostoevsky',
        id: "afa5de03-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'crime']
    },
    {
        title: 'Demons',
        published: 1872,
        author: 'Fyodor Dostoevsky',
        id: "afa5de04-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'revolution']
    },
]

/*
  you can remove the placeholder query once your first one has been implemented 
*/

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
    }
`

const resolvers = {
    Query: {
        bookCount: () => books.length,
        authorCount: () => authors.length,
        allBooks: (root, args) => {
            console.log('allBooks.args', args)

            // if no author or genres given in the arguments
            if (!args.author && !args.genre) {
                console.log('no author and generes given')
                return books
            }

            let booklist = books


            // if author is given search for matches
            if (args.author) {
                booklist = booklist.filter(book => book.author === args.author)
            }

            // if genre is given search for matches in genres array
            if (args.genre) {
                booklist = booklist.filter(book => book.genres.includes(args.genre))
            }

            console.log('booklist', booklist)

            return booklist

        },
        allAuthors: () => {
            return authors
        }
    },
    Author: {
        bookCount: (author) => books.filter(book => book.author === author.name).length
    },
    Mutation: {
        addBook: (root, args) => {

            console.log('addBook.args', args)

            // check if author already exists get id
            const existingAuthor = authors.find(author => author.name === args.author)
            console.log('existing author', existingAuthor)

            authorId = existingAuthor ? existingAuthor.id : null

            // if not exists create new record
            if (!authorId) {
                console.log('create new record')

                authorId = uuid()

                const author = {
                    "name": args.author,
                    "born": null,
                    "id": authorId
                }
                console.log('author object to add: ', author)

                authors = authors.concat(author)
                console.log('authors after adding new author', authors)
            }

            console.log('authorId before adding book', authorId)

            // add book
            const book = { ...args, id: uuid() }
            books = books.concat(book)

            console.log('books after mutation', books)
            console.log('authors after mutation', authors)
            return book
        },
        editAuthor: (root, args) => {

            console.log('editAuthor.args', args)
            const author = authors.find(p => p.name === args.name)
            console.log('editAuthor.author', author)
            if (!author) {
                return null
            }

            const updatedAuthor = { ...author, born: args.setBornTo }
            authors = authors.map(p => p.name === args.name ? updatedAuthor : p)
            return updatedAuthor
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

startStandaloneServer(server, {
    listen: { port: 4000 },
}).then(({ url }) => {
    console.log(`Server ready at ${url}`)
})